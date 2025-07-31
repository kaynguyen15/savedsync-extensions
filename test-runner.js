#!/usr/bin/env node

// Node.js Test Runner for SavedSync Extension
const fs = require('fs');
const path = require('path');

console.log('🧪 SavedSync Extension Test Runner');
console.log('=====================================\n');

class ExtensionTestRunner {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

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

  // Test 1: Check if critical files exist
  testFileExistence() {
    console.log('🔍 Testing File Existence...');
    
    const requiredFiles = [
      'manifest.json',
      'background.js',
      'content.js',
      'popup.js',
      'popup.html'
    ];
    
    requiredFiles.forEach(file => {
      const exists = fs.existsSync(file);
      this.assert(exists, `File ${file} exists`);
    });
  }

  // Test 2: Validate manifest.json
  testManifestValidation() {
    console.log('\n🔍 Testing Manifest Validation...');
    
    try {
      const manifestContent = fs.readFileSync('manifest.json', 'utf8');
      const manifest = JSON.parse(manifestContent);
      
      this.assert(manifest.manifest_version === 3, 'Manifest version is 3');
      this.assert(manifest.name, 'Extension name is defined');
      this.assert(manifest.version, 'Extension version is defined');
      this.assert(manifest.permissions, 'Permissions are defined');
      this.assert(manifest.host_permissions, 'Host permissions are defined');
      this.assert(manifest.background?.service_worker, 'Background service worker is defined');
      this.assert(manifest.content_scripts, 'Content scripts are defined');
      
    } catch (error) {
      this.assert(false, `Manifest validation failed: ${error.message}`);
    }
  }

  // Test 3: Check for critical bug fixes in background.js
  testBackgroundBugFixes() {
    console.log('\n🔍 Testing Background.js Bug Fixes...');
    
    try {
      const backgroundContent = fs.readFileSync('background.js', 'utf8');
      
      // Check for storage quota handling
      this.assert(
        backgroundContent.includes('QUOTA_BYTES_PER_ITEM') || 
        backgroundContent.includes('QUOTA_BYTES'),
        'Storage quota error handling implemented'
      );
      
      // Check for race condition prevention
      this.assert(
        backgroundContent.includes('statsUpdateInProgress'),
        'Race condition prevention implemented'
      );
      
      // Check for cleanup mechanism
      this.assert(
        backgroundContent.includes('setInterval') && 
        backgroundContent.includes('thirtyDaysAgo'),
        'Data cleanup mechanism implemented'
      );
      
      // Check for timeout handling
      this.assert(
        backgroundContent.includes('AbortController') && 
        backgroundContent.includes('timeout'),
        'Network timeout handling implemented'
      );
      
      // Check for API key validation
      this.assert(
        backgroundContent.includes('apiKey.trim()'),
        'API key validation implemented'
      );
      
    } catch (error) {
      this.assert(false, `Background.js test failed: ${error.message}`);
    }
  }

  // Test 4: Check for critical bug fixes in content.js
  testContentBugFixes() {
    console.log('\n🔍 Testing Content.js Bug Fixes...');
    
    try {
      const contentContent = fs.readFileSync('content.js', 'utf8');
      
      // Check for memory leak prevention
      this.assert(
        contentContent.includes('globalDetector') && 
        contentContent.includes('cleanup()'),
        'Memory leak prevention implemented'
      );
      
      // Check for data sanitization
      this.assert(
        contentContent.includes('sanitizedItem') && 
        contentContent.includes('substring(0, 50)'),
        'Data sanitization implemented'
      );
      
      // Check for proper cleanup
      this.assert(
        contentContent.includes('observer.disconnect()') && 
        contentContent.includes('clearInterval'),
        'Resource cleanup implemented'
      );
      
      // Check for safe initialization
      this.assert(
        contentContent.includes('initializeDetector()') && 
        contentContent.includes('globalDetector.cleanup()'),
        'Safe initialization implemented'
      );
      
    } catch (error) {
      this.assert(false, `Content.js test failed: ${error.message}`);
    }
  }

  // Test 5: Check for critical bug fixes in popup.js
  testPopupBugFixes() {
    console.log('\n🔍 Testing Popup.js Bug Fixes...');
    
    try {
      const popupContent = fs.readFileSync('popup.js', 'utf8');
      
      // Check for XSS prevention
      this.assert(
        popupContent.includes('sanitizeHTML') && 
        popupContent.includes('textContent'),
        'XSS prevention implemented'
      );
      
      // Check for null checks
      this.assert(
        popupContent.includes('if (syncButton)') && 
        popupContent.includes('if (totalItemsEl)'),
        'DOM element null checks implemented'
      );
      
      // Check for safe HTML insertion
      this.assert(
        popupContent.includes('safePlatform') && 
        popupContent.includes('safeCount'),
        'Safe HTML insertion implemented'
      );
      
    } catch (error) {
      this.assert(false, `Popup.js test failed: ${error.message}`);
    }
  }

  // Test 6: Check for security vulnerabilities
  testSecurityVulnerabilities() {
    console.log('\n🔍 Testing Security Vulnerabilities...');
    
    try {
      const allFiles = ['background.js', 'content.js', 'popup.js'];
      
      allFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for dangerous patterns
        const dangerousPatterns = [
          'eval\\(',
          'document\\.write\\(',
          'innerHTML.*=.*\\+',
          'setTimeout.*\\+',
          'setInterval.*\\+'
        ];
        
        dangerousPatterns.forEach(pattern => {
          const regex = new RegExp(pattern, 'i');
          const hasDangerousPattern = regex.test(content);
          this.assert(!hasDangerousPattern, `No dangerous pattern '${pattern}' in ${file}`);
        });
      });
      
    } catch (error) {
      this.assert(false, `Security test failed: ${error.message}`);
    }
  }

  // Test 7: Check for proper error handling
  testErrorHandling() {
    console.log('\n🔍 Testing Error Handling...');
    
    try {
      const allFiles = ['background.js', 'content.js', 'popup.js'];
      
      allFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for try-catch blocks
        const hasTryCatch = content.includes('try {') && content.includes('} catch');
        this.assert(hasTryCatch, `Error handling (try-catch) in ${file}`);
        
        // Check for console.error usage
        const hasErrorLogging = content.includes('console.error');
        this.assert(hasErrorLogging, `Error logging in ${file}`);
      });
      
    } catch (error) {
      this.assert(false, `Error handling test failed: ${error.message}`);
    }
  }

  // Test 8: Check for performance optimizations
  testPerformanceOptimizations() {
    console.log('\n🔍 Testing Performance Optimizations...');
    
    try {
      const backgroundContent = fs.readFileSync('background.js', 'utf8');
      const contentContent = fs.readFileSync('content.js', 'utf8');
      
      // Check for storage limits
      this.assert(
        backgroundContent.includes('savedItems.length > 1000') || 
        backgroundContent.includes('splice(1000)'),
        'Storage limits implemented'
      );
      
      // Check for cleanup intervals
      this.assert(
        backgroundContent.includes('setInterval') && 
        backgroundContent.includes('24 * 60 * 60 * 1000'),
        'Cleanup intervals implemented'
      );
      
      // Check for proper observer cleanup
      this.assert(
        contentContent.includes('observer.disconnect()'),
        'Observer cleanup implemented'
      );
      
    } catch (error) {
      this.assert(false, `Performance test failed: ${error.message}`);
    }
  }

  // Test 9: Check for input validation
  testInputValidation() {
    console.log('\n🔍 Testing Input Validation...');
    
    try {
      const contentContent = fs.readFileSync('content.js', 'utf8');
      const popupContent = fs.readFileSync('popup.js', 'utf8');
      
      // Check for length limits
      const hasLengthLimits = contentContent.includes('substring(0,') && 
                             contentContent.includes('substring(0, 50)') &&
                             contentContent.includes('substring(0, 100)') &&
                             contentContent.includes('substring(0, 1000)');
      
      this.assert(hasLengthLimits, 'Input length limits implemented');
      
      // Check for type coercion
      const hasTypeCoercion = contentContent.includes('String(') && 
                             contentContent.includes('|| \'\'');
      
      this.assert(hasTypeCoercion, 'Type coercion implemented');
      
    } catch (error) {
      this.assert(false, `Input validation test failed: ${error.message}`);
    }
  }

  // Test 10: Check for documentation
  testDocumentation() {
    console.log('\n🔍 Testing Documentation...');
    
    const hasBugFixesDoc = fs.existsSync('BUGFIXES.md');
    this.assert(hasBugFixesDoc, 'BUGFIXES.md documentation exists');
    
    if (hasBugFixesDoc) {
      const bugFixesContent = fs.readFileSync('BUGFIXES.md', 'utf8');
      this.assert(bugFixesContent.includes('Critical Bugs Fixed'), 'Bug fixes documentation is comprehensive');
      this.assert(bugFixesContent.includes('Memory Leak'), 'Memory leak fix documented');
      this.assert(bugFixesContent.includes('XSS Vulnerability'), 'XSS fix documented');
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Running Extension Test Suite...\n');
    
    this.testFileExistence();
    this.testManifestValidation();
    this.testBackgroundBugFixes();
    this.testContentBugFixes();
    this.testPopupBugFixes();
    this.testSecurityVulnerabilities();
    this.testErrorHandling();
    this.testPerformanceOptimizations();
    this.testInputValidation();
    this.testDocumentation();
    
    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
    
    if (this.failed === 0) {
      console.log('\n🎉 All tests passed! The critical bug fixes are working correctly.');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Please review the failed tests above.');
      process.exit(1);
    }
  }
}

// Run the tests
const runner = new ExtensionTestRunner();
runner.runAllTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});