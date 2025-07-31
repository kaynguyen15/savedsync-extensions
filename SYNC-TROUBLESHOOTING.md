# SavedSync Extension - Sync Troubleshooting Guide

## Common Sync Issues and Solutions

### 🔴 Issue: "Sync not configured"
**Symptoms:**
- Sync button is disabled
- Status shows "Sync not configured"
- No sync attempts are made

**Solution:**
1. Click "Settings" in the extension popup
2. Enter your server URL (e.g., `https://your-server.com`)
3. Enter your API key
4. Check "Enable automatic sync"
5. Click "Save Settings"
6. Use "Test Connection" to verify your settings

### 🔴 Issue: "Invalid API key"
**Symptoms:**
- Sync fails with "Invalid API key" error
- 401 status code from server

**Solution:**
1. Verify your API key is correct
2. Check that the API key has proper permissions
3. Ensure the API key is not expired
4. Try regenerating the API key in your mobile app

### 🔴 Issue: "Server error" or "Connection failed"
**Symptoms:**
- Sync fails with network errors
- "Failed to fetch" or "CORS error" messages

**Solutions:**
1. **Check your internet connection**
2. **Verify server URL format:**
   - Use: `https://your-server.com`
   - Don't include trailing slash
   - Ensure it's a valid HTTPS URL
3. **Check server status:**
   - Verify your server is running
   - Check if the server is accessible from your browser
4. **CORS issues:**
   - Ensure your server allows requests from browser extensions
   - Server must include proper CORS headers

### 🔴 Issue: "Request timeout"
**Symptoms:**
- Sync fails after 30 seconds
- "Request timeout" error message

**Solutions:**
1. **Check server performance:**
   - Server may be overloaded
   - Try syncing during off-peak hours
2. **Reduce data size:**
   - Extension automatically limits to 100 items per sync
   - Consider clearing old items if you have many
3. **Check network speed:**
   - Slow internet connection may cause timeouts

### 🔴 Issue: "Sync endpoint not found"
**Symptoms:**
- 404 error from server
- "Sync endpoint not found" message

**Solution:**
1. Verify your server has the correct API endpoint
2. The extension expects: `/api/sync/bulk`
3. Full URL should be: `https://your-server.com/api/sync/bulk`
4. Check your server's API documentation

### 🔴 Issue: "No items to sync"
**Symptoms:**
- Sync button is disabled
- Status shows "No items to sync"

**Solution:**
1. Visit social media sites (Instagram, Facebook, TikTok, etc.)
2. Save some posts/videos
3. The extension will automatically detect saved items
4. Wait a few minutes for detection to complete

## Sync Configuration Guide

### Step 1: Get Your Server Details
1. Open your mobile app
2. Go to Settings > Sync Configuration
3. Note your server URL and API key

### Step 2: Configure Extension
1. Open SavedSync extension popup
2. Click "Settings"
3. Enter your server URL (without trailing slash)
4. Enter your API key
5. Check "Enable automatic sync"
6. Click "Save Settings"

### Step 3: Test Connection
1. Click "Test Connection" button
2. If successful, you'll see "Connection test successful!"
3. If failed, check the error message and troubleshoot

### Step 4: Sync Your Data
1. Return to the main popup
2. Click "Sync Now" button
3. Monitor the sync status
4. Check the "Last sync" timestamp

## Server Requirements

Your server must support the following:

### API Endpoints
- `GET /api/sync/test` - Connection test endpoint
- `POST /api/sync/bulk` - Bulk sync endpoint

### Request Format
```json
POST /api/sync/bulk
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_API_KEY

Body:
{
  "items": [
    {
      "platform": "instagram",
      "type": "post",
      "author": "username",
      "content": "Post content",
      "url": "https://instagram.com/p/...",
      "savedDate": "2024-01-01T00:00:00.000Z"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### CORS Headers
Your server must include:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Debugging Tips

### Check Browser Console
1. Open browser developer tools (F12)
2. Go to Console tab
3. Look for SavedSync error messages
4. Check for network errors

### Check Extension Logs
1. Go to `chrome://extensions/`
2. Find SavedSync extension
3. Click "Details"
4. Click "Service Worker" to see background script logs

### Test Server Manually
```bash
# Test connection
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://your-server.com/api/sync/test

# Test sync endpoint
curl -X POST \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d '{"items":[],"timestamp":"2024-01-01T00:00:00.000Z"}' \
     https://your-server.com/api/sync/bulk
```

## Common Error Messages

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Sync not configured" | Missing settings | Configure server URL and API key |
| "Invalid API key" | Wrong or expired key | Check API key in mobile app |
| "Connection failed" | Network/server issue | Check internet and server status |
| "Request timeout" | Server too slow | Try again later or check server |
| "CORS error" | Server CORS misconfigured | Check server CORS headers |
| "No items to sync" | No saved items detected | Save some posts first |

## Still Having Issues?

If you're still experiencing sync problems:

1. **Check the browser console** for detailed error messages
2. **Verify your server is running** and accessible
3. **Test with a simple curl command** to isolate the issue
4. **Check your server logs** for any errors
5. **Ensure your API key has proper permissions**
6. **Try disabling and re-enabling sync**

## Support

For additional help:
1. Check this troubleshooting guide
2. Review your server's API documentation
3. Check the browser console for error details
4. Verify your network connectivity
5. Test with a different API key if available