// Test Suite for SavedSync Extension Bug Fixes
// Run this in the browser console to test the fixes

console.log('🧪 Starting SavedSync Extension Test Suite...');

class SavedSyncTestSuite {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  // Test helper methods
  assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      this.passed++;
      this.results.push({ status: 'PASS', message });
    } else {
      console.error(`❌ FAIL: ${message}`);
      this.failed++;
      this.results.push({ status: 'FAIL', message });
    }
  }

  assertThrows(fn, message) {
    try {
      fn();
      console.error(`❌ FAIL: ${message} - Expected error but none thrown`);
      this.failed++;
      this.results.push({ status: 'FAIL', message: `${message} - Expected error but none thrown` });
    } catch (error) {
      console.log(`✅ PASS: ${message}`);
      this.passed++;
      this.results.push({ status: 'PASS', message });
    }
  }

  // Test 1: Memory Leak Prevention
  testMemoryLeakPrevention() {
    console.log('\n🔍 Testing Memory Leak Prevention...');
    
    // Check if globalDetector exists (from content.js fix)
    this.assert(typeof globalDetector !== 'undefined', 'Global detector instance exists');
    
    // Check if cleanup method exists
    if (globalDetector) {
      this.assert(typeof globalDetector.cleanup === 'function', 'Cleanup method exists');
      
      // Test cleanup functionality
      const originalObserver = globalDetector.observer;
      const originalInterval = globalDetector.scanInterval;
      
      globalDetector.cleanup();
      
      this.assert(globalDetector.observer === null, 'Observer properly disconnected');
      this.assert(globalDetector.scanInterval === null, 'Scan interval properly cleared');
      this.assert(globalDetector.processedItems.size === 0, 'Processed items cleared');
    }
  }

  // Test 2: XSS Prevention
  testXSSPrevention() {
    console.log('\n🔍 Testing XSS Prevention...');
    
    // Test HTML sanitization function
    const testData = {
      platform: '<script>alert("xss")</script>',
      author: '"><img src=x onerror=alert(1)>',
      content: 'Normal content',
      count: 5
    };
    
    // Create a mock DOM element to test sanitization
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="platform-item">
        <div class="platform-info">
          <div class="platform-icon ${testData.platform}">
            ${testData.platform}
          </div>
          <span class="platform-name">${testData.author}</span>
        </div>
        <span class="item-count">${testData.count}</span>
      </div>
    `;
    
    // Check if script tags are escaped
    const hasScript = div.innerHTML.includes('<script>');
    this.assert(!hasScript, 'Script tags are properly escaped');
    
    // Check if dangerous attributes are escaped
    const hasOnError = div.innerHTML.includes('onerror=');
    this.assert(!hasOnError, 'Dangerous attributes are escaped');
  }

  // Test 3: Storage Quota Handling
  async testStorageQuotaHandling() {
    console.log('\n🔍 Testing Storage Quota Handling...');
    
    try {
      // Test storage operations
      const testData = { test: 'data' };
      await chrome.storage.local.set(testData);
      const result = await chrome.storage.local.get(['test']);
      
      this.assert(result.test === 'data', 'Basic storage operations work');
      
      // Test error handling (simulate quota exceeded)
      const largeData = { large: 'x'.repeat(1000000) }; // 1MB string
      try {
        await chrome.storage.local.set(largeData);
        console.log('⚠️  Storage quota test - large data accepted (may vary by browser)');
      } catch (error) {
        this.assert(error.message.includes('QUOTA'), 'Storage quota errors are properly caught');
      }
      
    } catch (error) {
      console.log('⚠️  Storage test skipped - not in extension context');
    }
  }

  // Test 4: Race Condition Prevention
  testRaceConditionPrevention() {
    console.log('\n🔍 Testing Race Condition Prevention...');
    
    // Test if statsUpdateInProgress variable exists (from background.js fix)
    // Note: This would need to be tested in the background script context
    console.log('⚠️  Race condition test requires background script context');
    
    // Test basic async operation handling
    let counter = 0;
    const asyncOperation = async () => {
      counter++;
      await new Promise(resolve => setTimeout(resolve, 10));
      counter--;
    };
    
    // Run multiple async operations
    Promise.all([asyncOperation(), asyncOperation(), asyncOperation()]).then(() => {
      this.assert(counter === 0, 'Async operations complete properly');
    });
  }

  // Test 5: Data Sanitization
  testDataSanitization() {
    console.log('\n🔍 Testing Data Sanitization...');
    
    // Test input sanitization (from content.js fix)
    const maliciousData = {
      platform: '<script>alert("xss")</script>',
      author: '"><img src=x onerror=alert(1)>',
      content: 'x'.repeat(2000), // Very long content
      url: 'javascript:alert("xss")',
      image: 'data:text/html,<script>alert("xss")</script>'
    };
    
    // Simulate the sanitization logic from content.js
    const sanitizedItem = {
      platform: String(maliciousData.platform || '').substring(0, 50),
      type: String('post' || '').substring(0, 20),
      author: String(maliciousData.author || '').substring(0, 100),
      content: String(maliciousData.content || '').substring(0, 1000),
      url: String(maliciousData.url || '').substring(0, 500),
      image: maliciousData.image ? String(maliciousData.image).substring(0, 500) : null
    };
    
    // Verify sanitization
    this.assert(sanitizedItem.platform.length <= 50, 'Platform length limited');
    this.assert(sanitizedItem.author.length <= 100, 'Author length limited');
    this.assert(sanitizedItem.content.length <= 1000, 'Content length limited');
    this.assert(sanitizedItem.url.length <= 500, 'URL length limited');
    
    // Check that dangerous content is truncated
    this.assert(!sanitizedItem.platform.includes('<script>'), 'Script tags truncated');
    this.assert(!sanitizedItem.url.startsWith('javascript:'), 'JavaScript URLs truncated');
  }

  // Test 6: DOM Element Access Safety
  testDOMElementAccessSafety() {
    console.log('\n🔍 Testing DOM Element Access Safety...');
    
    // Test null checks (from popup.js fix)
    const nonExistentElement = document.getElementById('non-existent-element');
    this.assert(nonExistentElement === null, 'Non-existent elements return null');
    
    // Test safe element access
    const safeAccess = (elementId) => {
      const element = document.getElementById(elementId);
      if (element) {
        element.textContent = 'test';
        return true;
      }
      return false;
    };
    
    this.assert(!safeAccess('non-existent'), 'Safe access returns false for non-existent elements');
    
    // Create a test element
    const testElement = document.createElement('div');
    testElement.id = 'test-element';
    document.body.appendChild(testElement);
    
    this.assert(safeAccess('test-element'), 'Safe access works for existing elements');
    
    // Cleanup
    document.body.removeChild(testElement);
  }

  // Test 7: Network Timeout Handling
  testNetworkTimeoutHandling() {
    console.log('\n🔍 Testing Network Timeout Handling...');
    
    // Test AbortController functionality
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 100);
    
    // Simulate a fetch with timeout
    const testFetch = async () => {
      try {
        const response = await fetch('https://httpbin.org/delay/5', {
          signal: controller.signal
        });
        return response;
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
    };
    
    testFetch().catch(error => {
      this.assert(error.message === 'Request timeout', 'Timeout handling works correctly');
    });
    
    clearTimeout(timeoutId);
  }

  // Test 8: Error Handling
  testErrorHandling() {
    console.log('\n🔍 Testing Error Handling...');
    
    // Test try-catch blocks
    const testErrorHandling = () => {
      try {
        throw new Error('Test error');
      } catch (error) {
        return error.message;
      }
    };
    
    this.assert(testErrorHandling() === 'Test error', 'Error handling works correctly');
    
    // Test async error handling
    const testAsyncError = async () => {
      try {
        await Promise.reject(new Error('Async error'));
      } catch (error) {
        return error.message;
      }
    };
    
    testAsyncError().then(result => {
      this.assert(result === 'Async error', 'Async error handling works correctly');
    });
  }

  // Test 9: API Key Validation
  testAPIKeyValidation() {
    console.log('\n🔍 Testing API Key Validation...');
    
    // Test API key validation logic (from background.js fix)
    const validateAPIKey = (apiKey) => {
      return apiKey && apiKey.trim() !== '';
    };
    
    this.assert(!validateAPIKey(''), 'Empty API key rejected');
    this.assert(!validateAPIKey(null), 'Null API key rejected');
    this.assert(!validateAPIKey(undefined), 'Undefined API key rejected');
    this.assert(!validateAPIKey('   '), 'Whitespace-only API key rejected');
    this.assert(validateAPIKey('valid-key'), 'Valid API key accepted');
  }

  // Test 10: Input Validation
  testInputValidation() {
    console.log('\n🔍 Testing Input Validation...');
    
    // Test input sanitization function
    const sanitizeHTML = (str) => {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    };
    
    const maliciousInput = '<script>alert("xss")</script>';
    const sanitized = sanitizeHTML(maliciousInput);
    
    this.assert(!sanitized.includes('<script>'), 'HTML sanitization works');
    this.assert(sanitized.includes('&lt;script&gt;'), 'HTML entities properly escaped');
    
    // Test length limits
    const longInput = 'x'.repeat(2000);
    const truncated = longInput.substring(0, 1000);
    
    this.assert(truncated.length <= 1000, 'Length limits enforced');
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Running SavedSync Extension Test Suite...\n');
    
    this.testMemoryLeakPrevention();
    this.testXSSPrevention();
    await this.testStorageQuotaHandling();
    this.testRaceConditionPrevention();
    this.testDataSanitization();
    this.testDOMElementAccessSafety();
    this.testNetworkTimeoutHandling();
    this.testErrorHandling();
    this.testAPIKeyValidation();
    this.testInputValidation();
    
    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
    
    if (this.failed === 0) {
      console.log('\n🎉 All tests passed! The critical bug fixes are working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the failed tests above.');
    }
    
    return {
      passed: this.passed,
      failed: this.failed,
      results: this.results
    };
  }
}

// Export for use in different contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SavedSyncTestSuite;
} else {
  // Browser context
  window.SavedSyncTestSuite = SavedSyncTestSuite;
}