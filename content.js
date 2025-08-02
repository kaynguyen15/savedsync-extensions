// content.js - Debug version to understand Facebook & Threads structure

class SavedItemDetector {
  constructor() {
    // Check if extension context is valid before initializing
    if (!chrome.runtime?.id) {
      console.log('SavedSync: Extension context invalidated, not initializing');
      return;
    }
    
    this.platform = this.detectPlatform();
    this.processedItems = new Set(); // Track processed items
    this.isActive = true; // Track if detector should be active
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
      if (this.isActive && chrome.runtime?.id) {
        this.scanForSavedItems();
      }
    }, 5000); // Increased delay for Facebook/Threads
    
    // Monitor for changes (new posts loading, saves happening)
    this.observeDOM();
    
    // More frequent scanning for Facebook/Threads
    this.scanInterval = setInterval(() => {
      if (this.isActive && chrome.runtime?.id) {
        this.scanForSavedItems();
      } else {
        clearInterval(this.scanInterval);
      }
    }, 15000); // Every 15 seconds
  }
  
  observeDOM() {
    const observer = new MutationObserver((mutations) => {
      if (!this.isActive || !chrome.runtime?.id) {
        observer.disconnect();
        return;
      }
      
      let shouldScan = false;
      
      try {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (let node of mutation.addedNodes) {
              if (node.nodeType === 1 && node.children && node.children.length > 0) {
                shouldScan = true;
                break;
              }
            }
          }
          
          if (mutation.type === 'attributes') {
            const target = mutation.target;
            if (target.getAttribute && (
              target.getAttribute('aria-label')?.includes('Save') ||
              target.getAttribute('aria-label')?.includes('Remove') ||
              target.getAttribute('aria-label')?.includes('Saved') ||
              target.getAttribute('aria-pressed') === 'true'
            )) {
              shouldScan = true;
            }
          }
        });
        
        if (shouldScan && this.isActive && chrome.runtime?.id) {
          setTimeout(() => {
            if (this.isActive && chrome.runtime?.id) {
              this.scanForSavedItems();
            }
          }, 2000); // Longer delay for dynamic content
        }
      } catch (error) {
        if (error.message?.includes('Extension context invalidated')) {
          console.log('SavedSync: Extension reloaded, stopping DOM observer');
          this.isActive = false;
          observer.disconnect();
          return;
        }
        console.error('Error in DOM observer:', error);
      }
    });
    
    try {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-label', 'aria-pressed', 'class', 'data-testid']
      });
    } catch (error) {
      console.error('Error setting up DOM observer:', error);
    }
  }
  
  scanForSavedItems() {
    if (!this.isActive || !chrome.runtime?.id) {
      console.log('SavedSync: Extension context invalid, stopping scan');
      return;
    }
    
    console.log(`SavedSync: Scanning for saved items on ${this.platform}`);
    
    try {
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
    } catch (error) {
      if (error.message?.includes('Extension context invalidated')) {
        console.log('SavedSync: Extension reloaded, stopping all detection');
        this.isActive = false;
        return;
      }
      console.error('Error in scanForSavedItems:', error);
    }
  }
  
  // Instagram detection (working)
  detectInstagramSaved() {
    if (!this.isActive || !chrome.runtime?.id) return;
    
    try {
      const bookmarkButtons = document.querySelectorAll('[aria-label*="Remove"], [aria-label*="Save"]');
      
      bookmarkButtons.forEach(button => {
        try {
          if (!this.isActive || !chrome.runtime?.id) return;
          
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
          if (error.message?.includes('Extension context invalidated')) {
            this.isActive = false;
            return;
          }
          console.error('Error processing Instagram button:', error);
        }
      });
    } catch (error) {
      console.error('Error in detectInstagramSaved:', error);
    }
  }
  
  extractInstagramPost(element) {
    if (!this.isActive || !chrome.runtime?.id) return;
    
    try {
      const authorLink = element.querySelector('header a[role="link"]');
      const author = authorLink?.textContent?.trim() || '@unknown';
      
      const contentSpans = element.querySelectorAll('span');
      let content = '';
      for (let span of contentSpans) {
        const text = span.textContent?.trim();
        if (text && text.length > 20 && !text.includes('•') && !text.includes('Follow')) {
          content = text;
          break;
        }
      }
      
      const img = element.querySelector('img[src*="instagram"]');
      const video = element.querySelector('video');
      
      const item = {
        platform: 'instagram',
        type: video ? 'video' : 'post',
        author: author,
        content: content,
        image: img?.src || video?.poster || null,
        url: window.location.href
      };
      
      this.sendToBackground(item);
    } catch (error) {
      if (error.message?.includes('Extension context invalidated')) {
        this.isActive = false;
        return;
      }
      console.error('Error extracting Instagram post:', error);
    }
  }
  
  // FACEBOOK - Enhanced Debug Version
  detectFacebookSaved() {
    console.log('🔍 SavedSync: DEBUGGING Facebook detection...');
    console.log('Current URL:', window.location.href);
    
    // Debug: Show all possible save-related elements
    const allElements = document.querySelectorAll('*');
    const saveRelated = [];
    
    allElements.forEach(el => {
      const ariaLabel = el.getAttribute('aria-label') || '';
      const testId = el.getAttribute('data-testid') || '';
      const text = el.textContent || '';
      
      if (
        ariaLabel.toLowerCase().includes('save') ||
        ariaLabel.toLowerCase().includes('bookmark') ||
        testId.toLowerCase().includes('save') ||
        text.toLowerCase().includes('saved') ||
        text.toLowerCase().includes('save to')
      ) {
        saveRelated.push({
          element: el,
          tag: el.tagName,
          ariaLabel: ariaLabel,
          testId: testId,
          text: text.substring(0, 50),
          classes: el.className
        });
      }
    });
    
    console.log(`🔍 Found ${saveRelated.length} save-related elements:`, saveRelated);
    
    // Method 1: Look for specific save patterns
    const patterns = [
      '[aria-label*="Save"]',
      '[aria-label*="Saved"]',
      '[aria-label*="Remove from saved"]',
      '[data-testid*="save"]',
      'div[role="button"]:has-text("Save")',
      'span:contains("Saved")'
    ];
    
    patterns.forEach((pattern, index) => {
      try {
        const elements = document.querySelectorAll(pattern);
        console.log(`🔍 Pattern ${index + 1} (${pattern}): Found ${elements.length} elements`);
        
        elements.forEach((el, elIndex) => {
          console.log(`  Element ${elIndex}:`, {
            tag: el.tagName,
            ariaLabel: el.getAttribute('aria-label'),
            text: el.textContent?.substring(0, 30),
            classes: el.className
          });
        });
      } catch (error) {
        console.log(`🔍 Pattern ${index + 1} failed:`, error.message);
      }
    });
    
    // Method 2: Look for posts that might be saved
    const posts = document.querySelectorAll('[role="article"], [data-testid="fbfeed_story"], div[data-pagelet*="FeedUnit"]');
    console.log(`🔍 Found ${posts.length} potential Facebook posts`);
    
    posts.forEach((post, index) => {
      if (index < 3) { // Only log first 3 posts to avoid spam
        const saveButton = post.querySelector('[aria-label*="Save"], [aria-label*="Saved"]');
        console.log(`🔍 Post ${index}:`, {
          hasSaveButton: !!saveButton,
          saveButtonLabel: saveButton?.getAttribute('aria-label'),
          postText: post.textContent?.substring(0, 50)
        });
      }
    });
    
    // Check if we're on saved items page
    if (window.location.href.includes('saved') || window.location.pathname.includes('saved')) {
      console.log('🔍 ON FACEBOOK SAVED PAGE - treating all posts as saved');
      
      posts.forEach((post, index) => {
        try {
          const postId = this.getElementIdentifier(post);
          if (!this.processedItems.has(postId)) {
            this.processedItems.add(postId);
            console.log(`🔍 Extracting saved post ${index}...`);
            this.extractFacebookPost(post);
          }
        } catch (error) {
          console.error('Error processing Facebook saved post:', error);
        }
      });
    } else {
      // Look for saved indicators in regular feed
      const savedButtons = document.querySelectorAll('[aria-label*="Remove from saved"], [aria-label*="Saved"]');
      console.log(`🔍 Found ${savedButtons.length} saved buttons in feed`);
      
      savedButtons.forEach((button, index) => {
        try {
          const post = button.closest('[role="article"], [data-testid="fbfeed_story"]');
          if (post) {
            const postId = this.getElementIdentifier(post);
            if (!this.processedItems.has(postId)) {
              this.processedItems.add(postId);
              console.log(`🔍 Extracting saved post from button ${index}...`);
              this.extractFacebookPost(post);
            }
          }
        } catch (error) {
          console.error('Error processing Facebook saved button:', error);
        }
      });
    }
  }
  
  extractFacebookPost(element) {
    try {
      console.log('🔍 Extracting Facebook post...');
      
      // Find author with multiple strategies
      let author = 'Unknown Facebook User';
      const authorSelectors = [
        'h3 a[role="link"]',
        'strong a[role="link"]',
        '[data-testid="post_message"] strong',
        'h4 a',
        'strong'
      ];
      
      for (let selector of authorSelectors) {
        const authorEl = element.querySelector(selector);
        if (authorEl && authorEl.textContent.trim()) {
          author = authorEl.textContent.trim();
          console.log(`🔍 Found author with selector "${selector}": ${author}`);
          break;
        }
      }
      
      // Find content
      let content = 'Facebook post';
      const contentSelectors = [
        '[data-testid="post_message"]',
        '[data-ad-preview="message"]',
        'div[dir="auto"]'
      ];
      
      for (let selector of contentSelectors) {
        const contentEl = element.querySelector(selector);
        if (contentEl && contentEl.textContent.trim()) {
          content = contentEl.textContent.trim().substring(0, 200);
          console.log(`🔍 Found content with selector "${selector}": ${content.substring(0, 50)}...`);
          break;
        }
      }
      
      // Find image
      const img = element.querySelector('img[src*="facebook"], img[src*="fbcdn"], img[data-delayed]');
      
      const item = {
        platform: 'facebook',
        type: 'post',
        author: author,
        content: content,
        image: img?.src || null,
        url: window.location.href
      };
      
      console.log('🔍 Facebook item created:', item);
      this.sendToBackground(item);
      
    } catch (error) {
      console.error('Error extracting Facebook post:', error);
    }
  }
  
  // THREADS - Enhanced Debug Version
  detectThreadsSaved() {
    console.log('🧵 SavedSync: DEBUGGING Threads detection...');
    console.log('Current URL:', window.location.href);
    
    // Show all possible save buttons
    const allButtons = document.querySelectorAll('button, [role="button"], div[role="button"]');
    const saveButtons = [];
    
    allButtons.forEach(btn => {
      const ariaLabel = btn.getAttribute('aria-label') || '';
      const text = btn.textContent || '';
      
      if (
        ariaLabel.toLowerCase().includes('save') ||
        ariaLabel.toLowerCase().includes('bookmark') ||
        text.toLowerCase().includes('save')
      ) {
        saveButtons.push({
          element: btn,
          ariaLabel: ariaLabel,
          text: text.substring(0, 30),
          pressed: btn.getAttribute('aria-pressed')
        });
      }
    });
    
    console.log(`🧵 Found ${saveButtons.length} potential save buttons:`, saveButtons);
    
    // Look for articles (posts)
    const articles = document.querySelectorAll('[role="article"]');
    console.log(`🧵 Found ${articles.length} Threads articles`);
    
    articles.forEach((article, index) => {
      if (index < 3) { // Only log first 3 to avoid spam
        const saveBtn = article.querySelector('[aria-label*="Save"], [aria-label*="bookmark"]');
        console.log(`🧵 Article ${index}:`, {
          hasSaveButton: !!saveBtn,
          saveButtonLabel: saveBtn?.getAttribute('aria-label'),
          articleText: article.textContent?.substring(0, 50)
        });
      }
    });
    
    // Process saved items
    saveButtons.forEach((btnInfo, index) => {
      try {
        const isSaved = btnInfo.pressed === 'true' || 
                       btnInfo.ariaLabel.includes('Remove') ||
                       btnInfo.ariaLabel.includes('Saved');
        
        console.log(`🧵 Button ${index} isSaved: ${isSaved}`);
        
        if (isSaved) {
          const article = btnInfo.element.closest('[role="article"]');
          if (article) {
            const postId = this.getElementIdentifier(article);
            if (!this.processedItems.has(postId)) {
              this.processedItems.add(postId);
              console.log(`🧵 Extracting Threads post ${index}...`);
              this.extractThreadsPost(article);
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
      console.log('🧵 Extracting Threads post...');
      
      // Find author
      let author = '@unknown';
      const authorLinks = element.querySelectorAll('a[role="link"]');
      
      authorLinks.forEach(link => {
        const text = link.textContent?.trim();
        if (text && text.startsWith('@')) {
          author = text;
          console.log(`🧵 Found author: ${author}`);
        }
      });
      
      // Find content
      let content = 'Threads post';
      const contentDivs = element.querySelectorAll('div[dir="auto"]');
      
      contentDivs.forEach(div => {
        const text = div.textContent?.trim();
        if (text && text.length > 10 && !text.startsWith('@') && !text.includes('•')) {
          content = text.substring(0, 200);
          console.log(`🧵 Found content: ${content.substring(0, 50)}...`);
        }
      });
      
      const item = {
        platform: 'threads',
        type: 'post',
        author: author,
        content: content,
        image: null,
        url: window.location.href
      };
      
      console.log('🧵 Threads item created:', item);
      this.sendToBackground(item);
      
    } catch (error) {
      console.error('Error extracting Threads post:', error);
    }
  }
  
  // Simplified TikTok and Twitter (keep existing logic but add context checks)
  detectTikTokSaved() {
    if (!this.isActive || !chrome.runtime?.id) return;
    // Keep existing TikTok logic
  }
  
  detectTwitterSaved() {
    if (!this.isActive || !chrome.runtime?.id) return;
    // Keep existing Twitter logic
  }
  
  // Helper methods
  getElementIdentifier(element) {
    const rect = element.getBoundingClientRect();
    const content = element.textContent?.substring(0, 50) || '';
    return `${this.platform}-${rect.top}-${rect.left}-${content.replace(/\s+/g, '')}`;
  }
  
  sendToBackground(item) {
    console.log('📤 SavedSync: Sending item to background:', item);
    
    if (!chrome.runtime?.id) {
      console.log('SavedSync: Extension context invalidated, skipping send');
      return;
    }
    
    try {
      chrome.runtime.sendMessage({
        type: 'SAVED_ITEM_DETECTED',
        data: item
      }).catch(error => {
        if (error.message?.includes('Extension context invalidated')) {
          console.log('SavedSync: Extension reloaded, stopping detection');
          return;
        }
        console.error('Error sending to background:', error);
      });
    } catch (error) {
      if (error.message?.includes('Extension context invalidated')) {
        console.log('SavedSync: Extension reloaded, stopping detection');
        return;
      }
      console.error('Error sending to background:', error);
    }
  }
}

// Initialize with delay and context checking
setTimeout(() => {
  if (chrome.runtime?.id) {
    new SavedItemDetector();
  }
}, 2000);

// Navigation handling
let currentUrl = window.location.href;
let detector = null;

setInterval(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    
    if (detector) {
      detector.isActive = false;
    }
    
    setTimeout(() => {
      if (chrome.runtime?.id) {
        detector = new SavedItemDetector();
      }
    }, 3000);
  }
}, 2000);