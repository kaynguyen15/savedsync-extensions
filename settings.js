// settings.js - Settings page functionality

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Settings page loaded');
  
  // Load current settings
  await loadCurrentSettings();
  
  // Set up event listeners
  document.getElementById('settingsForm').addEventListener('submit', saveSettings);
  document.getElementById('testConnection').addEventListener('click', testConnection);
  
  // Update status
  await updateConnectionStatus();
});

async function loadCurrentSettings() {
  try {
    const result = await chrome.storage.local.get(['syncSettings']);
    const settings = result.syncSettings || {};
    
    document.getElementById('serverUrl').value = settings.serverUrl || '';
    document.getElementById('apiKey').value = settings.apiKey || '';
    document.getElementById('enableSync').checked = settings.enabled || false;
    
    console.log('Loaded settings:', settings);
  } catch (error) {
    console.error('Error loading settings:', error);
    showError('Failed to load current settings');
  }
}

async function saveSettings(event) {
  event.preventDefault();
  
  const serverUrl = document.getElementById('serverUrl').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim();
  const enableSync = document.getElementById('enableSync').checked;
  
  // Validate URL
  if (!serverUrl) {
    showError('Server URL is required');
    return;
  }
  
  try {
    new URL(serverUrl); // This will throw if invalid
  } catch (error) {
    showError('Please enter a valid URL');
    return;
  }
  
  // Remove trailing slash
  const cleanUrl = serverUrl.replace(/\/$/, '');
  
  const settings = {
    serverUrl: cleanUrl,
    apiKey: apiKey,
    enabled: enableSync
  };
  
  try {
    await chrome.storage.local.set({ syncSettings: settings });
    console.log('Settings saved:', settings);
    
    showSuccess();
    await updateConnectionStatus();
    
    // Test connection after saving
    setTimeout(testConnection, 1000);
    
  } catch (error) {
    console.error('Error saving settings:', error);
    showError('Failed to save settings');
  }
}

async function testConnection() {
  const button = document.getElementById('testConnection');
  const originalText = button.textContent;
  
  try {
    button.disabled = true;
    button.textContent = 'Testing...';
    
    const result = await chrome.storage.local.get(['syncSettings']);
    const settings = result.syncSettings || {};
    
    if (!settings.serverUrl) {
      showError('Please enter a server URL first');
      return;
    }
    
    // Test basic connectivity
    const response = await fetch(`${settings.serverUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      showSuccess(`✅ Connection successful! Server is healthy. Items stored: ${data.itemCount || 0}`);
      updateStatusIndicator(true, 'Connected to server');
    } else {
      throw new Error(`Server responded with status ${response.status}`);
    }
    
  } catch (error) {
    console.error('Connection test failed:', error);
    showError(`Connection failed: ${error.message}`);
    updateStatusIndicator(false, 'Connection failed');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function updateConnectionStatus() {
  try {
    const result = await chrome.storage.local.get(['syncSettings']);
    const settings = result.syncSettings || {};
    
    if (!settings.serverUrl) {
      updateStatusIndicator(false, 'No server configured');
      return;
    }
    
    if (!settings.enabled) {
      updateStatusIndicator(false, 'Sync disabled');
      return;
    }
    
    // Try to ping the server
    try {
      const response = await fetch(`${settings.serverUrl}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        updateStatusIndicator(true, 'Connected and syncing');
      } else {
        updateStatusIndicator(false, 'Server unreachable');
      }
    } catch (error) {
      updateStatusIndicator(false, 'Server unreachable');
    }
    
  } catch (error) {
    console.error('Error checking connection status:', error);
    updateStatusIndicator(false, 'Status unknown');
  }
}

function updateStatusIndicator(connected, message) {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  
  if (connected) {
    statusDot.className = 'status-dot connected';
  } else {
    statusDot.className = 'status-dot disconnected';
  }
  
  statusText.textContent = message;
}

function showSuccess(message = 'Settings saved successfully!') {
  const successDiv = document.getElementById('successMessage');
  const errorDiv = document.getElementById('errorMessage');
  
  errorDiv.style.display = 'none';
  successDiv.textContent = message;
  successDiv.style.display = 'block';
  
  setTimeout(() => {
    successDiv.style.display = 'none';
  }, 5000);
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  const successDiv = document.getElementById('successMessage');
  const errorText = document.getElementById('errorText');
  
  successDiv.style.display = 'none';
  errorText.textContent = message;
  errorDiv.style.display = 'block';
  
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}