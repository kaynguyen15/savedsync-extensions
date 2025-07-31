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
    
    // Get stats from background script with proper error handling
    const stats = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
    
    console.log('Stats received:', stats);
    
    // Ensure stats is valid before updating UI
    if (!stats || typeof stats !== 'object') {
      throw new Error('Invalid stats response');
    }
    
    // Update UI with null checks
    const totalElement = document.getElementById('totalItems');
    const todayElement = document.getElementById('todayItems');
    const platformsElement = document.getElementById('platforms');
    
    if (totalElement) totalElement.textContent = stats.totalItems || 0;
    if (todayElement) todayElement.textContent = stats.todayItems || 0;
    if (platformsElement) platformsElement.textContent = stats.platforms || 0;
    
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
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'SYNC_NOW' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
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
          const settings = {
            serverUrl: document.getElementById('serverUrl').value,
            apiKey: document.getElementById('apiKey').value,
            enabled: document.getElementById('enableSync').checked
          };
          
          chrome.storage.local.set({ syncSettings: settings }, () => {
            alert('Settings saved!');
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