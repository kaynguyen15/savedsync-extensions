// content.js - Detects saved items on social media platforms

// Global instance to prevent multiple detectors
let globalDetector = null;

class SavedItemDetector {
  constructor() {
    this.platform = this.detectPlatform();
    this.processedItems = new Set(); // Track processed items
    this.observer = null;
    this.scanInterval = null;
    this.navigationInterval = null;
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
  
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    if (this.navigationInterval) {
      clearInterval(this.navigationInterval);
      this.navigationInterval = null;
    }
    this.processedItems.clear();
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
      // Find author
      const authorLink = element.querySelector('header a[role="link"]');
      const author = authorLink?.textContent?.trim() || '@unknown';
      
      // Find content
      const contentSpans = element.querySelectorAll('span');
      let content = '';
      for (let span of contentSpans) {
        const text = span.textContent?.trim();
        if (text && text.length > 20 && !text.includes('•') && !text.includes('Follow')) {
          content = text;
          break;
        }
      }
      
      // Find media
      const img = element.querySelector('img[src*="instagram"]');
      const video = element.querySelector('video');
      
      // Get engagement data
      const likeButton = element.querySelector('[aria-label*="like"]');
      const likesText = likeButton?.getAttribute('aria-label') || '';
      
      const item = {
        platform: 'instagram',
        type: video ? 'video' : 'post',
        author: author,
        content: content,
        image: img?.src || video?.poster || null,
        url: window.location.href,
        engagement: {
          likes: this.extractNumber(likesText)
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
      // Find author
      const authorElement = element.querySelector('[data-e2e*="username"], a[href*="/@"]');
      const author = authorElement?.textContent?.trim() || '@unknown';
      
      // Find description
      const descElement = element.querySelector('[data-e2e*="desc"], [data-e2e*="browse-video-desc"]');
      const content = descElement?.textContent?.trim() || '';
      
      // Find video thumbnail
      const video = element.querySelector('video');
      const thumbnail = video?.poster || null;
      
      const item = {
        platform: 'tiktok',
        type: 'video',
        author: author,
        content: content,
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
      // Find author
      const authorElement = element.querySelector('[data-testid="User-Name"] span');
      const author = authorElement?.textContent?.trim() || '@unknown';
      
      // Find content
      const contentElement = element.querySelector('[data-testid="tweetText"]');
      const content = contentElement?.textContent?.trim() || '';
      
      // Find image
      const img = element.querySelector('[data-testid="tweetPhoto"] img');
      
      const item = {
        platform: 'twitter',
        type: 'tweet',
        author: author,
        content: content,
        image: img?.src || null,
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
    // Sanitize item data to prevent injection attacks
    const sanitizedItem = {
      platform: String(item.platform || '').substring(0, 50),
      type: String(item.type || '').substring(0, 20),
      author: String(item.author || '').substring(0, 100),
      content: String(item.content || '').substring(0, 1000),
      url: String(item.url || '').substring(0, 500),
      image: item.image ? String(item.image).substring(0, 500) : null,
      thumbnail: item.thumbnail ? String(item.thumbnail).substring(0, 500) : null,
      engagement: item.engagement ? {
        likes: String(item.engagement.likes || '0').substring(0, 20)
      } : null
    };
    
    console.log('SavedSync: Detected saved item:', sanitizedItem);
    
    chrome.runtime.sendMessage({
      type: 'SAVED_ITEM_DETECTED',
      data: sanitizedItem
    }).catch(error => {
      console.error('Error sending to background:', error);
    });
  }
}

// Initialize detector when page loads
function initializeDetector() {
  if (globalDetector) {
    globalDetector.cleanup();
  }
  globalDetector = new SavedItemDetector();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDetector);
} else {
  initializeDetector();
}

// Also initialize on navigation (for SPAs)
let currentUrl = window.location.href;
const navigationInterval = setInterval(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    setTimeout(initializeDetector, 2000);
  }
}, 1000);

// Store interval reference for cleanup
if (globalDetector) {
  globalDetector.navigationInterval = navigationInterval;
}