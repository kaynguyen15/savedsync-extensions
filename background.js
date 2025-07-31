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

// Storage queue to prevent concurrent writes
let storageQueue = Promise.resolve();

// Handle detected saved item
async function handleSavedItem(item) {
  // Queue this operation to prevent concurrent storage writes
  storageQueue = storageQueue.then(async () => {
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
        
        await chrome.storage.local.set({ savedItems });
        
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
  });
  
  return storageQueue;
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
    
    // Send to server
    const response = await fetch(`${syncSettings.serverUrl}/sync/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${syncSettings.apiKey}`
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
      throw new Error(`Server responded with ${response.status}`);
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