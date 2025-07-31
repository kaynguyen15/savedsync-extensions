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

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);
  
  try {
    if (message.type === 'SAVED_ITEM_DETECTED') {
      if (!message.data || typeof message.data !== 'object') {
        console.error('Invalid saved item data received');
        sendResponse({ success: false, error: 'Invalid data format' });
        return;
      }
      
      handleSavedItem(message.data);
      sendResponse({ success: true });
    }
    
    else if (message.type === 'GET_STATS') {
      getStats().then(stats => {
        sendResponse(stats);
      }).catch(error => {
        console.error('Error getting stats:', error);
        sendResponse({ 
          totalItems: 0, 
          todayItems: 0, 
          platforms: 0, 
          platformCounts: {},
          error: 'Failed to get stats'
        });
      });
      return true; // Keep channel open for async response
    }
    
    else if (message.type === 'SYNC_NOW') {
      syncToServer().then(result => {
        sendResponse(result);
      }).catch(error => {
        console.error('Error during sync:', error);
        sendResponse({ 
          success: false, 
          message: 'Sync failed: ' + error.message 
        });
      });
      return true;
    }
    
    else {
      console.warn('Unknown message type received:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
    }
    
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: 'Internal error' });
  }
});

// Handle detected saved item
async function handleSavedItem(item) {
  try {
    console.log('Processing saved item:', item);
    
    // Validate and sanitize input data
    if (!item || typeof item !== 'object') {
      console.error('Invalid item data received');
      return;
    }
    
    // Sanitize item data
    const sanitizedItem = {
      platform: String(item.platform || 'unknown').substring(0, 50),
      type: String(item.type || 'post').substring(0, 20),
      author: String(item.author || 'Unknown').substring(0, 100),
      content: String(item.content || '').substring(0, 1000),
      image: item.image && typeof item.image === 'string' ? item.image.substring(0, 500) : null,
      thumbnail: item.thumbnail && typeof item.thumbnail === 'string' ? item.thumbnail.substring(0, 500) : null,
      url: item.url && typeof item.url === 'string' ? item.url.substring(0, 500) : null,
      engagement: item.engagement && typeof item.engagement === 'object' ? {
        likes: parseInt(item.engagement.likes) || 0
      } : { likes: 0 }
    };
    
    // Get existing saved items
    const result = await chrome.storage.local.get(['savedItems']);
    const savedItems = result.savedItems || [];
    
    // Check if item already exists (prevent duplicates)
    const exists = savedItems.some(existing => 
      existing.platform === sanitizedItem.platform && 
      existing.url === sanitizedItem.url &&
      existing.content === sanitizedItem.content
    );
    
    if (!exists) {
      // Add timestamp and unique ID
      sanitizedItem.id = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sanitizedItem.savedDate = new Date().toISOString();
      sanitizedItem.detectedAt = new Date().toISOString();
      
      savedItems.unshift(sanitizedItem); // Add to beginning
      
      // Keep only last 1000 items to prevent storage bloat
      if (savedItems.length > 1000) {
        savedItems.splice(1000);
      }
      
      await chrome.storage.local.set({ savedItems });
      
      // Update stats
      await updateStats();
      
      // Try to sync to server if configured
      await syncToServer();
      
      console.log('Saved item stored:', sanitizedItem.platform, sanitizedItem.author);
      
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

// Update statistics
async function updateStats() {
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
    
    // Validate server URL
    let serverUrl = syncSettings.serverUrl.trim();
    if (!serverUrl.startsWith('https://')) {
      console.error('Invalid server URL: must use HTTPS');
      return { success: false, message: 'Invalid server URL: must use HTTPS' };
    }
    
    // Remove trailing slash if present
    if (serverUrl.endsWith('/')) {
      serverUrl = serverUrl.slice(0, -1);
    }
    
    // Validate API key
    if (!syncSettings.apiKey || syncSettings.apiKey.trim().length === 0) {
      console.error('API key is required for server sync');
      return { success: false, message: 'API key is required' };
    }
    
    // Send to server
    const response = await fetch(`${serverUrl}/api/sync/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${syncSettings.apiKey.trim()}`
      },
      body: JSON.stringify({ 
        items: savedItems,
        timestamp: new Date().toISOString()
      })
    });
    
    if (response.ok) {
      console.log('Successfully synced to server');
      return { success: true, message: 'Synced successfully' };
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }
    
  } catch (error) {
    console.error('Error syncing to server:', error);
    return { success: false, message: error.message };
  }
}

// Periodic sync (every 5 minutes if items exist)
setInterval(async () => {
  const result = await chrome.storage.local.get(['savedItems']);
  const savedItems = result.savedItems || [];
  
  if (savedItems.length > 0) {
    await syncToServer();
  }
}, 5 * 60 * 1000); // 5 minutes