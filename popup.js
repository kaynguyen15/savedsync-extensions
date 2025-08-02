// popup.js - Extension popup interface

document.addEventListener('DOMContentLoaded', async () => {
  console.log('SavedSync popup loaded');
  
  // Load initial stats
  await loadStats();
  
  // Set up event listeners
  document.getElementById('syncButton').addEventListener('click', syncNow);
  document.getElementById('settingsLink').addEventListener('click', openSettings);
  document.getElementById('exportLink').addEventListener('click', exportData);
  document.getElementById('helpLink').addEventListener('click', openHelp);
  
  // Auto-refresh stats every 30 seconds
  setInterval(loadStats, 30000);
});

async function loadStats() {
  try {
    console.log('Loading stats...');
    
    // Get stats from background script
    const stats = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_STATS' }, resolve);
    });
    
    console.log('Stats received:', stats);
    
    // Update UI
    document.getElementById('totalItems').textContent = stats.totalItems || 0;
    document.getElementById('todayItems').textContent = stats.todayItems || 0;
    document.getElementById('platforms').textContent = stats.platforms || 0;
    
    // Update platform list
    updatePlatformList(stats.platformCounts || {});
    
    // Update status
    updateStatus(stats);
    
  } catch (error) {
    console.error('Error loading stats:', error);
    showError('Failed to load stats');
  }
}

function updatePlatformList(platformCounts) {
  const platformList = document.getElementById('platformList');
  
  if (Object.keys(platformCounts).length === 0) {
    platformList.innerHTML = `
      <div class="empty-state">
        <h3>No saved items yet</h3>
        <p>Visit social media sites and save posts to see them here!</p>
      </div>
    `;
    return;
  }
  
  const platformIcons = {
    instagram: 'IG',
    facebook: 'FB',
    tiktok: 'TT',
    threads: 'TH',
    twitter: 'TW'
  };
  
  const platformNames = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    threads: 'Threads',
    twitter: 'Twitter'
  };
  
  platformList.innerHTML = Object.entries(platformCounts)
    .sort(([,a], [,b]) => b - a) // Sort by count descending
    .map(([platform, count]) => `
      <div class="platform-item">
        <div class="platform-info">
          <div class="platform-icon ${platform}">
            ${platformIcons[platform] || platform.substr(0, 2).toUpperCase()}
          </div>
          <span class="platform-name">${platformNames[platform] || platform}</span>
        </div>
        <span class="item-count">${count}</span>
      </div>
    `).join('');
}

function updateStatus(stats) {
  const statusDiv = document.getElementById('syncStatus');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  
  if (stats.totalItems > 0) {
    statusIndicator.className = 'status-indicator active';
    statusText.textContent = stats.lastSync ? 
      `Last sync: ${formatDate(stats.lastSync)}` : 
      'Ready to sync';
    statusDiv.className = 'sync-status success';
  } else {
    statusIndicator.className = 'status-indicator inactive';
    statusText.textContent = 'No items to sync';
    statusDiv.className = 'sync-status';
  }
}

async function syncNow() {
  const button = document.getElementById('syncButton');
  const statusText = document.getElementById('statusText');
  const originalText = button.textContent;
  
  try {
    button.disabled = true;
    button.textContent = 'Syncing...';
    statusText.textContent = 'Syncing to server...';
    
    // Trigger sync
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'SYNC_NOW' }, resolve);
    });
    
    if (result.success) {
      statusText.textContent = 'Sync completed successfully!';
      document.getElementById('syncStatus').className = 'sync-status success';
    } else {
      statusText.textContent = `Sync failed: ${result.message}`;
      document.getElementById('syncStatus').className = 'sync-status error';
    }
    
    // Refresh stats
    setTimeout(loadStats, 1000);
    
  } catch (error) {
    console.error('Sync error:', error);
    statusText.textContent = 'Sync failed';
    document.getElementById('syncStatus').className = 'sync-status error';
  } finally {
    button.disabled = false;
    button.textContent = originalText;
    
    // Reset status text after 3 seconds
    setTimeout(() => {
      loadStats();
    }, 3000);
  }
}

function openSettings() {
  // Open the settings page in a new tab
  chrome.tabs.create({ 
    url: chrome.runtime.getURL('settings.html') 
  });
}

async function exportData() {
  try {
    const result = await chrome.storage.local.get(['savedItems']);
    const savedItems = result.savedItems || [];
    
    if (savedItems.length === 0) {
      alert('No saved items to export!');
      return;
    }
    
    // Create CSV content
    const csvContent = [
      'Platform,Author,Content,URL,Saved Date,Type',
      ...savedItems.map(item => [
        item.platform,
        `"${(item.author || '').replace(/"/g, '""')}"`,
        `"${(item.content || '').replace(/"/g, '""')}"`,
        item.url || '',
        item.savedDate || '',
        item.type || ''
      ].join(','))
    ].join('\n');
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    chrome.downloads.download({
      url: url,
      filename: `savedsync-export-${new Date().toISOString().split('T')[0]}.csv`
    });
    
  } catch (error) {
    console.error('Export error:', error);
    alert('Failed to export data');
  }
}

function openHelp() {
  chrome.tabs.create({ 
    url: chrome.runtime.getURL('help.html') 
  });
}

function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return `${Math.floor(diffMinutes / 1440)}d ago`;
  } catch (error) {
    return 'unknown';
  }
}

function showError(message) {
  const statusDiv = document.getElementById('syncStatus');
  const statusText = document.getElementById('statusText');
  
  statusText.textContent = message;
  statusDiv.className = 'sync-status error';
  
  setTimeout(() => {
    loadStats();
  }, 3000);
}