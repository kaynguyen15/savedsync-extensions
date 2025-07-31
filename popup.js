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
  
  // Settings panel event listeners
  document.getElementById('closeSettings').addEventListener('click', closeSettings);
  document.getElementById('settingsForm').addEventListener('submit', saveSettings);
  document.getElementById('testConnection').addEventListener('click', testConnection);
  
  // Load current settings into the form
  await loadCurrentSettings();
  
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
  document.getElementById('settingsPanel').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settingsPanel').classList.add('hidden');
}

async function loadCurrentSettings() {
  try {
    const result = await chrome.storage.local.get(['syncSettings']);
    const settings = result.syncSettings || {};
    
    document.getElementById('serverUrl').value = settings.serverUrl || '';
    document.getElementById('apiKey').value = settings.apiKey || '';
    document.getElementById('enableSync').checked = settings.enabled || false;
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function saveSettings(e) {
  e.preventDefault();
  
  const serverUrl = document.getElementById('serverUrl').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim();
  const enabled = document.getElementById('enableSync').checked;
  
  // Validate URL format
  if (serverUrl && !isValidUrl(serverUrl)) {
    showConnectionStatus('Invalid URL format. Please enter a valid HTTP/HTTPS URL.', 'error');
    return;
  }
  
  // Remove trailing slash from URL
  const cleanUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
  
  const settings = {
    serverUrl: cleanUrl,
    apiKey: apiKey,
    enabled: enabled
  };
  
  try {
    await chrome.storage.local.set({ syncSettings: settings });
    showConnectionStatus('Settings saved successfully!', 'success');
    
    // Refresh stats to update sync status
    setTimeout(() => {
      loadStats();
      closeSettings();
    }, 1500);
    
  } catch (error) {
    console.error('Error saving settings:', error);
    showConnectionStatus('Failed to save settings.', 'error');
  }
}

async function testConnection() {
  const serverUrl = document.getElementById('serverUrl').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim();
  
  if (!serverUrl) {
    showConnectionStatus('Please enter a server URL first.', 'error');
    return;
  }
  
  if (!isValidUrl(serverUrl)) {
    showConnectionStatus('Invalid URL format. Please enter a valid HTTP/HTTPS URL.', 'error');
    return;
  }
  
  const testBtn = document.getElementById('testConnection');
  const originalText = testBtn.textContent;
  
  try {
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    showConnectionStatus('Testing connection to your backend...', 'info');
    
    // Remove trailing slash and test connection
    const cleanUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
    
    // Try a simple health check first
    const healthResponse = await fetch(`${cleanUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
      }
    });
    
    if (healthResponse.ok) {
      showConnectionStatus('✅ Connection successful! Your backend is reachable.', 'success');
    } else {
      // If health check fails, try the sync endpoint
      const syncResponse = await fetch(`${cleanUrl}/sync/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({ 
          items: [],
          timestamp: new Date().toISOString(),
          test: true
        })
      });
      
      if (syncResponse.ok || syncResponse.status === 400) {
        // 400 might be expected for empty test data
        showConnectionStatus('✅ Connection successful! Sync endpoint is reachable.', 'success');
      } else if (syncResponse.status === 401) {
        showConnectionStatus('⚠️ Connected but authentication failed. Check your API key.', 'error');
      } else if (syncResponse.status === 404) {
        showConnectionStatus('⚠️ Connected but sync endpoint not found. Check your URL path.', 'error');
      } else {
        showConnectionStatus(`❌ Server responded with status ${syncResponse.status}. Check your backend configuration.`, 'error');
      }
    }
    
  } catch (error) {
    console.error('Connection test failed:', error);
    
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      showConnectionStatus('❌ Cannot reach server. Check URL and ensure CORS is configured.', 'error');
    } else {
      showConnectionStatus(`❌ Connection failed: ${error.message}`, 'error');
    }
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = originalText;
  }
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function showConnectionStatus(message, type) {
  const statusDiv = document.getElementById('connectionStatus');
  statusDiv.textContent = message;
  statusDiv.className = `connection-status ${type}`;
  statusDiv.classList.remove('hidden');
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