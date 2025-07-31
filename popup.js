// popup.js - Extension popup interface

document.addEventListener('DOMContentLoaded', async () => {
  console.log('SavedSync popup loaded');
  
  // Load initial stats
  await loadStats();
  
  // Set up event listeners
  const syncButton = document.getElementById('syncButton');
  const settingsLink = document.getElementById('settingsLink');
  const exportLink = document.getElementById('exportLink');
  const helpLink = document.getElementById('helpLink');
  
  if (syncButton) syncButton.addEventListener('click', syncNow);
  if (settingsLink) settingsLink.addEventListener('click', openSettings);
  if (exportLink) exportLink.addEventListener('click', exportData);
  if (helpLink) helpLink.addEventListener('click', openHelp);
  
  // Auto-refresh stats every 30 seconds
  const statsInterval = setInterval(loadStats, 30000);
  
  // Cleanup on popup close
  window.addEventListener('beforeunload', () => {
    clearInterval(statsInterval);
  });
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
  
  // Clear existing content safely
  platformList.textContent = '';
  
  if (Object.keys(platformCounts).length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    
    const title = document.createElement('h3');
    title.textContent = 'No saved items yet';
    
    const description = document.createElement('p');
    description.textContent = 'Visit social media sites and save posts to see them here!';
    
    emptyState.appendChild(title);
    emptyState.appendChild(description);
    platformList.appendChild(emptyState);
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
  
  // Sort platforms by count descending
  const sortedPlatforms = Object.entries(platformCounts)
    .sort(([,a], [,b]) => b - a);
  
  sortedPlatforms.forEach(([platform, count]) => {
    const platformItem = document.createElement('div');
    platformItem.className = 'platform-item';
    
    const platformInfo = document.createElement('div');
    platformInfo.className = 'platform-info';
    
    const platformIcon = document.createElement('div');
    platformIcon.className = `platform-icon ${platform}`;
    platformIcon.textContent = platformIcons[platform] || platform.substr(0, 2).toUpperCase();
    
    const platformName = document.createElement('span');
    platformName.className = 'platform-name';
    platformName.textContent = platformNames[platform] || platform;
    
    const itemCount = document.createElement('span');
    itemCount.className = 'item-count';
    itemCount.textContent = count.toString();
    
    platformInfo.appendChild(platformIcon);
    platformInfo.appendChild(platformName);
    platformItem.appendChild(platformInfo);
    platformItem.appendChild(itemCount);
    platformList.appendChild(platformItem);
  });
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
  // Create a simple settings page
  const settingsHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>SavedSync Settings</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input[type="text"], input[type="url"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .info { background: #e7f3ff; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <h1>SavedSync Settings</h1>
      
      <div class="info">
        <p><strong>Mobile App Integration:</strong> Configure these settings to sync your saved items with the mobile app.</p>
      </div>
      
      <form id="settingsForm">
        <div class="form-group">
          <label for="serverUrl">Server URL:</label>
          <input type="url" id="serverUrl" placeholder="https://your-app-backend.com/api" />
        </div>
        
        <div class="form-group">
          <label for="apiKey">API Key:</label>
          <input type="text" id="apiKey" placeholder="Your mobile app API key" />
        </div>
        
        <div class="form-group">
          <label>
            <input type="checkbox" id="enableSync" /> Enable automatic sync
          </label>
        </div>
        
        <button type="submit">Save Settings</button>
      </form>
      
      <script>
        // Load current settings
        chrome.storage.local.get(['syncSettings'], (result) => {
          const settings = result.syncSettings || {};
          document.getElementById('serverUrl').value = settings.serverUrl || '';
          document.getElementById('apiKey').value = settings.apiKey || '';
          document.getElementById('enableSync').checked = settings.enabled || false;
        });
        
        // Save settings
        document.getElementById('settingsForm').addEventListener('submit', (e) => {
          e.preventDefault();
          
          const serverUrl = document.getElementById('serverUrl').value.trim();
          const apiKey = document.getElementById('apiKey').value.trim();
          const enabled = document.getElementById('enableSync').checked;
          
          // Validate server URL
          if (enabled && (!serverUrl || !serverUrl.startsWith('https://'))) {
            alert('Please enter a valid HTTPS server URL');
            return;
          }
          
          // Validate API key
          if (enabled && !apiKey) {
            alert('Please enter an API key');
            return;
          }
          
          const settings = {
            serverUrl: serverUrl,
            apiKey: apiKey,
            enabled: enabled
          };
          
          chrome.storage.local.set({ syncSettings: settings }, () => {
            if (chrome.runtime.lastError) {
              alert('Error saving settings: ' + chrome.runtime.lastError.message);
            } else {
              alert('Settings saved successfully!');
            }
          });
        });
      </script>
    </body>
    </html>
  `;
  
  // Create a new tab with settings
  const blob = new Blob([settingsHTML], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  chrome.tabs.create({ url });
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
  const helpHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>SavedSync Help</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
        h1, h2 { color: #333; }
        .section { margin-bottom: 30px; }
        .platform { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; }
        code { background: #e9ecef; padding: 2px 4px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <h1>SavedSync Help</h1>
      
      <div class="section">
        <h2>How it Works</h2>
        <p>SavedSync automatically detects when you save/bookmark posts on social media platforms and collects them in one place.</p>
      </div>
      
      <div class="section">
        <h2>Supported Platforms</h2>
        
        <div class="platform">
          <h3>Instagram</h3>
          <p>Detects when you bookmark posts or reels. Works on both the main feed and the saved collection page.</p>
        </div>
        
        <div class="platform">
          <h3>TikTok</h3>
          <p>Captures videos you've bookmarked using the save button on videos.</p>
        </div>
        
        <div class="platform">
          <h3>Facebook</h3>
          <p>Finds posts and articles you've saved to your saved items collection.</p>
        </div>
        
        <div class="platform">
          <h3>Threads</h3>
          <p>Detects saved threads and posts from Meta's Threads platform.</p>
        </div>
        
        <div class="platform">
          <h3>Twitter/X</h3>
          <p>Monitors your bookmarked tweets and threads.</p>
        </div>
      </div>
      
      <div class="section">
        <h2>Mobile App Integration</h2>
        <p>To sync with the mobile app:</p>
        <ol>
          <li>Go to Settings in this extension</li>
          <li>Enter your mobile app's server URL</li>
          <li>Add your API key</li>
          <li>Enable automatic sync</li>
        </ol>
      </div>
      
      <div class="section">
        <h2>Privacy & Data</h2>
        <p>SavedSync only accesses content you've already saved/bookmarked. It doesn't access your private messages, personal information, or any content you haven't explicitly saved.</p>
        <p>All data is stored locally in your browser and only synced to servers you configure.</p>
      </div>
      
      <div class="section">
        <h2>Troubleshooting</h2>
        <p><strong>Not detecting saves?</strong> Make sure you're actually bookmarking/saving posts on the platforms, not just liking them.</p>
        <p><strong>Sync not working?</strong> Check your server URL and API key in settings.</p>
        <p><strong>Missing platforms?</strong> Some platforms may take a few seconds to detect saves after page loads.</p>
      </div>
    </body>
    </html>
  `;
  
  const blob = new Blob([helpHTML], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  chrome.tabs.create({ url });
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