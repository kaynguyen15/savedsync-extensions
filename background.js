// background.js - Service Worker for SavedSync Extension

console.log('SavedSync background script loaded');

// Install listener
chrome.runtime.onInstalled.addListener(() => {
  console.log('SavedSync extension installed');
  
  // Initialize storage
  chrome.storage.local.set({
    savedItems: [],
    syncSettings: {
      enabled: false,
      serverUrl: '',
      apiKey: ''
    },
    stats: {
      totalItems: 0,
      todayItems: 0,
      lastSync: null
    }
  });
});

// Cleanup old data periodically (every 24 hours)
setInterval(async () => {
  try {
    const result = await chrome.storage.local.get(['savedItems']);
    const savedItems = result.savedItems || [];
    
    if (savedItems.length > 0) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Remove items older than 30 days
      const filteredItems = savedItems.filter(item => {
        const itemDate = new Date(item.savedDate);
        return itemDate > thirtyDaysAgo;
      });
      
      if (filteredItems.length !== savedItems.length) {
        await chrome.storage.local.set({ savedItems: filteredItems });
        console.log(`Cleaned up ${savedItems.length - filteredItems.length} old items`);
        await updateStats();
      }
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}, 24 * 60 * 60 * 1000); // 24 hours

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);
  
  if (message.type === 'SAVED_ITEM_DETECTED') {
    handleSavedItem(message.data);
    sendResponse({ success: true });
  }
  
  if (message.type === 'GET_STATS') {
    getStats().then(stats => sendResponse(stats));
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'SYNC_NOW') {
    syncToServer().then(result => sendResponse(result));
    return true;
  }
});

// Handle detected saved item
async function handleSavedItem(item) {
  try {
    console.log('Processing saved item:', item);
    
    // Get existing saved items
    const result = await chrome.storage.local.get(['savedItems']);
    const savedItems = result.savedItems || [];
    
    // Check if item already exists (prevent duplicates)
    const exists = savedItems.some(existing => 
      existing.platform === item.platform && 
      existing.url === item.url &&
      existing.content === item.content
    );
    
    if (!exists) {
      // Add timestamp and unique ID
      item.id = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      item.savedDate = new Date().toISOString();
      item.detectedAt = new Date().toISOString();
      
      savedItems.unshift(item); // Add to beginning
      
      // Keep only last 1000 items to prevent storage bloat
      if (savedItems.length > 1000) {
        savedItems.splice(1000);
      }
      
      try {
        await chrome.storage.local.set({ savedItems });
      } catch (storageError) {
        // Handle storage quota exceeded
        if (storageError.message.includes('QUOTA_BYTES_PER_ITEM') || 
            storageError.message.includes('QUOTA_BYTES')) {
          console.warn('Storage quota exceeded, cleaning up old items');
          
          // Remove oldest 100 items to free space
          savedItems.splice(-100);
          await chrome.storage.local.set({ savedItems });
          
          // Try again with reduced data
          if (savedItems.length > 500) {
            savedItems.splice(500);
            await chrome.storage.local.set({ savedItems });
          }
        } else {
          throw storageError;
        }
      }
      
      // Update stats
      await updateStats();
      
      // Try to sync to server if configured
      await syncToServer();
      
      console.log('Saved item stored:', item.platform, item.author);
      
      // Show notification badge
      chrome.action.setBadgeText({ text: savedItems.length.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      
    } else {
      console.log('Item already exists, skipping');
    }
  } catch (error) {
    console.error('Error storing saved item:', error);
  }
}

// Stats update lock to prevent race conditions
let statsUpdateInProgress = false;

// Update statistics
async function updateStats() {
  if (statsUpdateInProgress) {
    console.log('Stats update already in progress, skipping');
    return null;
  }
  
  statsUpdateInProgress = true;
  
  try {
    const result = await chrome.storage.local.get(['savedItems']);
    const savedItems = result.savedItems || [];
    
    const today = new Date().toDateString();
    const todayItems = savedItems.filter(item => 
      new Date(item.savedDate).toDateString() === today
    ).length;
    
    const stats = {
      totalItems: savedItems.length,
      todayItems: todayItems,
      lastSync: new Date().toISOString(),
      platforms: [...new Set(savedItems.map(item => item.platform))].length
    };
    
    await chrome.storage.local.set({ stats });
    return stats;
  } catch (error) {
    console.error('Error updating stats:', error);
    return null;
  } finally {
    statsUpdateInProgress = false;
  }
}

// Get current statistics
async function getStats() {
  try {
    const result = await chrome.storage.local.get(['savedItems', 'stats']);
    const savedItems = result.savedItems || [];
    
    // Calculate platform breakdown
    const platformCounts = {};
    savedItems.forEach(item => {
      platformCounts[item.platform] = (platformCounts[item.platform] || 0) + 1;
    });
    
    return {
      totalItems: savedItems.length,
      todayItems: savedItems.filter(item => 
        new Date(item.savedDate).toDateString() === new Date().toDateString()
      ).length,
      platforms: Object.keys(platformCounts).length,
      platformCounts: platformCounts,
      lastSync: result.stats?.lastSync || null
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    return { totalItems: 0, todayItems: 0, platforms: 0, platformCounts: {} };
  }
}

// Sync to server (if configured)
async function syncToServer() {
  try {
    const result = await chrome.storage.local.get(['savedItems', 'syncSettings']);
    const savedItems = result.savedItems || [];
    const syncSettings = result.syncSettings;
    
    if (!syncSettings?.enabled || !syncSettings?.serverUrl) {
      console.log('Sync not configured, skipping server sync');
      return { success: false, message: 'Sync not configured' };
    }
    
    // Validate API key
    if (!syncSettings.apiKey || syncSettings.apiKey.trim() === '') {
      console.log('No API key configured, skipping server sync');
      return { success: false, message: 'No API key configured' };
    }
    
    // Limit payload size to prevent timeout
    const maxItems = 100;
    const itemsToSync = savedItems.slice(0, maxItems);
    
    // Send to server with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      // Use the configured server URL instead of hardcoded URL
      const syncUrl = syncSettings.serverUrl.endsWith('/') 
        ? `${syncSettings.serverUrl}api/sync/bulk`
        : `${syncSettings.serverUrl}/api/sync/bulk`;
      
      console.log('Attempting to sync to:', syncUrl);
      
      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${syncSettings.apiKey}`
        },
        body: JSON.stringify({ 
          items: itemsToSync,
          timestamp: new Date().toISOString()
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log('Successfully synced to server');
        
        // Update last sync timestamp
        const currentStats = await chrome.storage.local.get(['stats']);
        const updatedStats = {
          ...currentStats.stats,
          lastSync: new Date().toISOString()
        };
        await chrome.storage.local.set({ stats: updatedStats });
        
        return { success: true, message: 'Synced successfully' };
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('Server error response:', response.status, errorText);
        
        // Handle specific error codes
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your settings.');
        } else if (response.status === 403) {
          throw new Error('Access denied. Please check your API key permissions.');
        } else if (response.status === 404) {
          throw new Error('Sync endpoint not found. Please check your server URL.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(`Server error (${response.status}): ${errorText}`);
        }
      }
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timeout - server took too long to respond');
      } else if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
        throw new Error('Network error - please check your internet connection');
      } else if (fetchError.message.includes('CORS')) {
        throw new Error('CORS error - server does not allow requests from this extension');
      } else if (fetchError.message.includes('Failed to fetch')) {
        throw new Error('Connection failed - please check your server URL and internet connection');
      }
      throw fetchError;
    }
    
  } catch (error) {
    console.error('Error syncing to server:', error);
    return { success: false, message: error.message };
  }
}

// Periodic sync (every 5 minutes if items exist and sync is configured)
setInterval(async () => {
  try {
    const result = await chrome.storage.local.get(['savedItems', 'syncSettings']);
    const savedItems = result.savedItems || [];
    const syncSettings = result.syncSettings || {};
    
    // Only sync if items exist and sync is properly configured
    if (savedItems.length > 0 && 
        syncSettings.enabled && 
        syncSettings.serverUrl && 
        syncSettings.apiKey) {
      console.log('Running periodic sync...');
      await syncToServer();
    }
  } catch (error) {
    console.error('Periodic sync error:', error);
  }
}, 5 * 60 * 1000); // 5 minutes