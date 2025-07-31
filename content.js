// content.js - Detects saved items on social media platforms

class SavedItemDetector {
  constructor() {
    this.platform = this.detectPlatform();
    this.processedItems = new Set(); // Track processed items
    this.observer = null; // Store observer reference
    this.scanInterval = null; // Store interval reference
    console.log(`SavedSync: Initialized on ${this.platform}`);
    this.init();
  }
  
  detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('instagram.com')) return 'instagram';
    if (hostname.includes('facebook.com')) return 'facebook';
    if (hostname.includes('tiktok.com')) return 'tiktok';
    if (hostname.includes('threads.net')) return 'threads';
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter';
    return 'unknown';
  }
  
  init() {
    if (this.platform === 'unknown') {
      console.log('SavedSync: Unknown platform, skipping');
      return;
    }
    
    // Initial scan after page loads
    setTimeout(() => {
      this.scanForSavedItems();
    }, 3000);
    
    // Monitor for changes (new posts loading, saves happening)
    this.observeDOM();
    
    // Periodic scan for missed items
    this.scanInterval = setInterval(() => {
      this.scanForSavedItems();
    }, 10000); // Every 10 seconds
  }
  
  observeDOM() {
    this.observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if significant content was added
          for (let node of mutation.addedNodes) {
            if (node.nodeType === 1 && node.children && node.children.length > 0) {
              shouldScan = true;
              break;
            }
          }
        }
        
        if (mutation.type === 'attributes') {
          // Check for attribute changes that might indicate saves
          const target = mutation.target;
          if (target.getAttribute && (
            target.getAttribute('aria-label')?.includes('Save') ||
            target.getAttribute('aria-label')?.includes('Remove') ||
            target.getAttribute('aria-pressed') === 'true'
          )) {
            shouldScan = true;
          }
        }
      });
      
      if (shouldScan) {
        setTimeout(() => this.scanForSavedItems(), 1000);
      }
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'aria-pressed', 'class']
    });
  }
  
  // Cleanup method to prevent memory leaks
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    
    this.processedItems.clear();
    console.log(`SavedSync: Cleaned up detector for ${this.platform}`);
  }
  
  scanForSavedItems() {
    console.log(`SavedSync: Scanning for saved items on ${this.platform}`);
    
    switch (this.platform) {
      case 'instagram':
        this.detectInstagramSaved();
        break;
      case 'facebook':
        this.detectFacebookSaved();
        break;
      case 'tiktok':
        this.detectTikTokSaved();
        break;
      case 'threads':
        this.detectThreadsSaved();
        break;
      case 'twitter':
        this.detectTwitterSaved();
        break;
    }
  }
  
  detectInstagramSaved() {
    // Look for bookmark buttons that are filled (saved state)
    const bookmarkButtons = document.querySelectorAll('[aria-label*="Remove"], [aria-label*="Save"]');
    
    bookmarkButtons.forEach(button => {
      try {
        const isSaved = button.getAttribute('aria-label')?.includes('Remove');
        
        if (isSaved) {
          const postElement = button.closest('article');
          if (postElement) {
            const postId = this.getElementIdentifier(postElement);
            if (!this.processedItems.has(postId)) {
              this.processedItems.add(postId);
              this.extractInstagramPost(postElement);
            }
          }
        }
      } catch (error) {
        console.error('Error processing Instagram button:', error);
      }
    });
    
    // Also check in saved collections page
    if (window.location.pathname.includes('/saved/')) {
      const savedPosts = document.querySelectorAll('article, div[role="button"] img');
      savedPosts.forEach(post => {
        try {
          const postId = this.getElementIdentifier(post);
          if (!this.processedItems.has(postId)) {
            this.processedItems.add(postId);
            this.extractInstagramPost(post.closest('article') || post);
          }
        } catch (error) {
          console.error('Error processing saved Instagram post:', error);
        }
      });
    }
  }
  
  extractInstagramPost(element) {
    try {
      if (!element) {
        console.warn('Instagram: No element provided for extraction');
        return;
      }
      
      // Find author with multiple fallback selectors
      let author = '@unknown';
      try {
        const authorSelectors = [
          'header a[role="link"]',
          'a[role="link"] span',
          'h2 a',
          'div[role="button"] span'
        ];
        
        for (const selector of authorSelectors) {
          const authorElement = element.querySelector(selector);
          if (authorElement?.textContent?.trim()) {
            author = authorElement.textContent.trim();
            break;
          }
        }
      } catch (e) {
        console.warn('Instagram: Error finding author:', e);
      }
      
      // Find content with fallback selectors
      let content = '';
      try {
        const contentSelectors = [
          'div[data-testid="post-content"] span',
          'article span',
          'div[role="button"] + div span'
        ];
        
        for (const selector of contentSelectors) {
          const contentSpans = element.querySelectorAll(selector);
          for (let span of contentSpans) {
            const text = span.textContent?.trim();
            if (text && text.length > 20 && !text.includes('•') && !text.includes('Follow')) {
              content = text;
              break;
            }
          }
          if (content) break;
        }
      } catch (e) {
        console.warn('Instagram: Error finding content:', e);
      }
      
      // Find media with fallback selectors
      let mediaUrl = null;
      try {
        const img = element.querySelector('img[src*="instagram"], img[src*="cdninstagram"]');
        const video = element.querySelector('video');
        mediaUrl = img?.src || video?.poster || null;
      } catch (e) {
        console.warn('Instagram: Error finding media:', e);
      }
      
      // Get engagement data safely
      let likes = '0';
      try {
        const likeButton = element.querySelector('[aria-label*="like"], [aria-label*="Like"]');
        const likesText = likeButton?.getAttribute('aria-label') || '';
        likes = this.extractNumber(likesText);
      } catch (e) {
        console.warn('Instagram: Error getting engagement data:', e);
      }
      
      const item = {
        platform: 'instagram',
        type: element.querySelector('video') ? 'video' : 'post',
        author: author,
        content: content || 'No caption available',
        image: mediaUrl,
        url: window.location.href,
        engagement: {
          likes: likes
        }
      };
      
      this.sendToBackground(item);
    } catch (error) {
      console.error('Error extracting Instagram post:', error);
    }
  }
  
  detectTikTokSaved() {
    // Look for filled bookmark icons
    const bookmarkButtons = document.querySelectorAll('[data-e2e*="save"], [aria-label*="Save"]');
    
    bookmarkButtons.forEach(button => {
      try {
        // Check if bookmark is filled/active
        const isActive = button.classList.contains('active') || 
                        button.getAttribute('aria-pressed') === 'true' ||
                        button.querySelector('svg[fill="#ff0050"]'); // TikTok's active color
        
        if (isActive) {
          const videoContainer = button.closest('[data-e2e="recommend-list-item"]') || 
                                button.closest('div[data-e2e*="video"]');
          
          if (videoContainer) {
            const videoId = this.getElementIdentifier(videoContainer);
            if (!this.processedItems.has(videoId)) {
              this.processedItems.add(videoId);
              this.extractTikTokVideo(videoContainer);
            }
          }
        }
      } catch (error) {
        console.error('Error processing TikTok button:', error);
      }
    });
  }
  
  extractTikTokVideo(element) {
    try {
      if (!element) {
        console.warn('TikTok: No element provided for extraction');
        return;
      }
      
      // Find author with fallback selectors
      let author = '@unknown';
      try {
        const authorSelectors = [
          '[data-e2e*="username"]',
          'a[href*="/@"]',
          '[data-e2e="browse-username"]',
          'h3 a[href*="/@"]'
        ];
        
        for (const selector of authorSelectors) {
          const authorElement = element.querySelector(selector);
          if (authorElement?.textContent?.trim()) {
            author = authorElement.textContent.trim();
            break;
          }
        }
      } catch (e) {
        console.warn('TikTok: Error finding author:', e);
      }
      
      // Find description with fallback selectors
      let content = '';
      try {
        const descSelectors = [
          '[data-e2e*="desc"]',
          '[data-e2e*="browse-video-desc"]',
          '[data-e2e="video-desc"]',
          'div[data-e2e*="video"] h1'
        ];
        
        for (const selector of descSelectors) {
          const descElement = element.querySelector(selector);
          if (descElement?.textContent?.trim()) {
            content = descElement.textContent.trim();
            break;
          }
        }
      } catch (e) {
        console.warn('TikTok: Error finding content:', e);
      }
      
      // Find video thumbnail safely
      let thumbnail = null;
      try {
        const video = element.querySelector('video');
        const img = element.querySelector('img[src*="tiktok"]');
        thumbnail = video?.poster || img?.src || null;
      } catch (e) {
        console.warn('TikTok: Error finding thumbnail:', e);
      }
      
      const item = {
        platform: 'tiktok',
        type: 'video',
        author: author,
        content: content || 'No description available',
        thumbnail: thumbnail,
        url: window.location.href
      };
      
      this.sendToBackground(item);
    } catch (error) {
      console.error('Error extracting TikTok video:', error);
    }
  }
  
  detectFacebookSaved() {
    // Look for saved indicators
    const savedIndicators = document.querySelectorAll('[aria-label*="Saved"], [data-testid*="save"]');
    
    savedIndicators.forEach(indicator => {
      try {
        const postElement = indicator.closest('[data-pagelet*="FeedUnit"]') || 
                           indicator.closest('[role="article"]');
        
        if (postElement) {
          const postId = this.getElementIdentifier(postElement);
          if (!this.processedItems.has(postId)) {
            this.processedItems.add(postId);
            this.extractFacebookPost(postElement);
          }
        }
      } catch (error) {
        console.error('Error processing Facebook indicator:', error);
      }
    });
  }
  
  extractFacebookPost(element) {
    try {
      // Find author
      const authorElement = element.querySelector('[data-testid="post_message"] strong, h3 a, strong a');
      const author = authorElement?.textContent?.trim() || 'Unknown';
      
      // Find content
      const contentElement = element.querySelector('[data-testid="post_message"], [data-ad-preview="message"]');
      const content = contentElement?.textContent?.trim() || '';
      
      // Find image
      const img = element.querySelector('img[data-delayed]');
      
      const item = {
        platform: 'facebook',
        type: 'post',
        author: author,
        content: content,
        image: img?.src || null,
        url: window.location.href
      };
      
      this.sendToBackground(item);
    } catch (error) {
      console.error('Error extracting Facebook post:', error);
    }
  }
  
  detectThreadsSaved() {
    // Threads uses similar structure to Instagram
    const saveButtons = document.querySelectorAll('[aria-label*="Save"], [role="button"][aria-pressed="true"]');
    
    saveButtons.forEach(button => {
      try {
        const isSaved = button.getAttribute('aria-label')?.includes('Remove') || 
                       button.getAttribute('aria-pressed') === 'true';
        
        if (isSaved) {
          const postElement = button.closest('[role="article"]');
          if (postElement) {
            const postId = this.getElementIdentifier(postElement);
            if (!this.processedItems.has(postId)) {
              this.processedItems.add(postId);
              this.extractThreadsPost(postElement);
            }
          }
        }
      } catch (error) {
        console.error('Error processing Threads button:', error);
      }
    });
  }
  
  extractThreadsPost(element) {
    try {
      // Find author
      const authorElement = element.querySelector('div[role="button"] span, a[role="link"] span');
      const author = authorElement?.textContent?.trim() || '@unknown';
      
      // Find content
      const contentElement = element.querySelector('div[dir="auto"]');
      const content = contentElement?.textContent?.trim() || '';
      
      const item = {
        platform: 'threads',
        type: 'post',
        author: author,
        content: content,
        url: window.location.href
      };
      
      this.sendToBackground(item);
    } catch (error) {
      console.error('Error extracting Threads post:', error);
    }
  }
  
  detectTwitterSaved() {
    // Look for bookmark buttons that are filled
    const bookmarkButtons = document.querySelectorAll('[data-testid="bookmark"], [aria-label*="Bookmark"]');
    
    bookmarkButtons.forEach(button => {
      try {
        const isBookmarked = button.querySelector('[data-testid="bookmarkFilled"]') !== null;
        
        if (isBookmarked) {
          const tweetElement = button.closest('[data-testid="tweet"]');
          if (tweetElement) {
            const tweetId = this.getElementIdentifier(tweetElement);
            if (!this.processedItems.has(tweetId)) {
              this.processedItems.add(tweetId);
              this.extractTwitterTweet(tweetElement);
            }
          }
        }
      } catch (error) {
        console.error('Error processing Twitter button:', error);
      }
    });
  }
  
  extractTwitterTweet(element) {
    try {
      if (!element) {
        console.warn('Twitter: No element provided for extraction');
        return;
      }
      
      // Find author with fallback selectors
      let author = '@unknown';
      try {
        const authorSelectors = [
          '[data-testid="User-Name"] span',
          '[data-testid="User-Names"] span',
          'div[dir="ltr"] span',
          'article span[dir="ltr"]'
        ];
        
        for (const selector of authorSelectors) {
          const authorElement = element.querySelector(selector);
          if (authorElement?.textContent?.trim() && !authorElement.textContent.includes('@')) {
            author = authorElement.textContent.trim();
            break;
          }
        }
      } catch (e) {
        console.warn('Twitter: Error finding author:', e);
      }
      
      // Find content with fallback selectors
      let content = '';
      try {
        const contentSelectors = [
          '[data-testid="tweetText"]',
          '[data-testid="tweet-text"]',
          'div[lang] span',
          'article div[dir="auto"]'
        ];
        
        for (const selector of contentSelectors) {
          const contentElement = element.querySelector(selector);
          if (contentElement?.textContent?.trim()) {
            content = contentElement.textContent.trim();
            break;
          }
        }
      } catch (e) {
        console.warn('Twitter: Error finding content:', e);
      }
      
      // Find image safely
      let imageUrl = null;
      try {
        const imgSelectors = [
          '[data-testid="tweetPhoto"] img',
          '[data-testid="tweet-photo"] img',
          'article img[src*="pbs.twimg.com"]'
        ];
        
        for (const selector of imgSelectors) {
          const img = element.querySelector(selector);
          if (img?.src) {
            imageUrl = img.src;
            break;
          }
        }
      } catch (e) {
        console.warn('Twitter: Error finding image:', e);
      }
      
      const item = {
        platform: 'twitter',
        type: 'tweet',
        author: author,
        content: content || 'No content available',
        image: imageUrl,
        url: window.location.href
      };
      
      this.sendToBackground(item);
    } catch (error) {
      console.error('Error extracting Twitter tweet:', error);
    }
  }
  
  // Helper methods
  getElementIdentifier(element) {
    // Create a unique identifier for an element
    const rect = element.getBoundingClientRect();
    const content = element.textContent?.substring(0, 50) || '';
    return `${this.platform}-${rect.top}-${rect.left}-${content.replace(/\s+/g, '')}`;
  }
  
  extractNumber(text) {
    const match = text.match(/[\d,]+/);
    return match ? match[0] : '0';
  }
  
  sendToBackground(item) {
    console.log('SavedSync: Detected saved item:', item);
    
    chrome.runtime.sendMessage({
      type: 'SAVED_ITEM_DETECTED',
      data: item
    }).catch(error => {
      console.error('Error sending to background:', error);
    });
  }
}

// Global detector instance to prevent memory leaks
let detectorInstance = null;

function initializeDetector() {
  // Clean up existing instance
  if (detectorInstance && detectorInstance.cleanup) {
    detectorInstance.cleanup();
  }
  
  detectorInstance = new SavedItemDetector();
}

// Initialize detector when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDetector);
} else {
  initializeDetector();
}

// Also initialize on navigation (for SPAs)
let currentUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    setTimeout(initializeDetector, 2000);
  }
}, 1000);