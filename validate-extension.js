#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 SavedSync Extension Final Validation\n');

// Required files for the extension
const requiredFiles = [
    'manifest.json',
    'background.js',
    'content.js',
    'popup.html',
    'popup.js',
    'icon16.png',
    'icon48.png',
    'icon128.png'
];

// File size limits (in bytes)
const sizeLimits = {
    'manifest.json': 5000,
    'background.js': 100000,
    'content.js': 200000,
    'popup.html': 10000,
    'popup.js': 20000,
    'icon16.png': 1000,
    'icon48.png': 3000,
    'icon128.png': 5000
};

let validationResults = {
    files: {},
    total: 0,
    passed: 0,
    failed: 0
};

function validateFile(filename) {
    const filePath = path.join(__dirname, filename);
    
    try {
        if (!fs.existsSync(filePath)) {
            return { exists: false, error: 'File not found' };
        }
        
        const stats = fs.statSync(filePath);
        const size = stats.size;
        const limit = sizeLimits[filename] || 100000;
        
        // Check file size
        if (size > limit) {
            return { 
                exists: true, 
                size: size, 
                limit: limit, 
                error: `File too large (${size} > ${limit} bytes)` 
            };
        }
        
        // Validate JSON files
        if (filename.endsWith('.json')) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                JSON.parse(content);
            } catch (error) {
                return { exists: true, size: size, error: `Invalid JSON: ${error.message}` };
            }
        }
        
        // Validate JavaScript files
        if (filename.endsWith('.js')) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                // Basic syntax check
                new Function(content);
            } catch (error) {
                return { exists: true, size: size, error: `JavaScript syntax error: ${error.message}` };
            }
        }
        
        return { exists: true, size: size, limit: limit, valid: true };
        
    } catch (error) {
        return { exists: false, error: error.message };
    }
}

function checkSecurityIssues() {
    const securityChecks = [];
    
    // Check for hardcoded URLs
    const filesToCheck = ['background.js', 'content.js', 'popup.js'];
    filesToCheck.forEach(filename => {
        const filePath = path.join(__dirname, filename);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for hardcoded URLs
            const hardcodedUrls = content.match(/https?:\/\/[^\s'"]+/g) || [];
            hardcodedUrls.forEach(url => {
                // Ignore placeholder URLs and common example domains
                if (!url.includes('example.com') && 
                    !url.includes('localhost') && 
                    !url.includes('your-app-backend.com') && // Placeholder URL
                    !url.includes('placeholder.com')) {
                    securityChecks.push({
                        file: filename,
                        issue: 'Hardcoded URL found',
                        url: url
                    });
                }
            });
            
            // Check for unsafe innerHTML usage
            if (content.includes('innerHTML') && !content.includes('textContent')) {
                securityChecks.push({
                    file: filename,
                    issue: 'Potential XSS vulnerability - innerHTML usage detected'
                });
            }
            
            // Check for eval usage
            if (content.includes('eval(')) {
                securityChecks.push({
                    file: filename,
                    issue: 'Security risk - eval() usage detected'
                });
            }
        }
    });
    
    return securityChecks;
}

function generateManifestSummary() {
    try {
        const manifestPath = path.join(__dirname, 'manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        
        return {
            name: manifest.name,
            version: manifest.version,
            manifest_version: manifest.manifest_version,
            permissions: manifest.permissions || [],
            host_permissions: manifest.host_permissions || [],
            content_scripts: manifest.content_scripts ? manifest.content_scripts.length : 0,
            has_background: !!manifest.background,
            has_popup: !!manifest.action?.default_popup
        };
    } catch (error) {
        return { error: error.message };
    }
}

// Run validation
console.log('📁 Checking required files...\n');

requiredFiles.forEach(filename => {
    const result = validateFile(filename);
    validationResults.files[filename] = result;
    validationResults.total++;
    
    if (result.valid) {
        validationResults.passed++;
        console.log(`✅ ${filename} - ${result.size} bytes`);
    } else {
        validationResults.failed++;
        console.log(`❌ ${filename} - ${result.error}`);
    }
});

// Security check
console.log('\n🔒 Checking for security issues...\n');
const securityIssues = checkSecurityIssues();

if (securityIssues.length === 0) {
    console.log('✅ No security issues detected');
} else {
    securityIssues.forEach(issue => {
        console.log(`⚠️  ${issue.file}: ${issue.issue}`);
        if (issue.url) {
            console.log(`   URL: ${issue.url}`);
        }
    });
}

// Manifest summary
console.log('\n📋 Manifest Summary:\n');
const manifestSummary = generateManifestSummary();

if (manifestSummary.error) {
    console.log(`❌ Manifest error: ${manifestSummary.error}`);
} else {
    console.log(`Name: ${manifestSummary.name}`);
    console.log(`Version: ${manifestSummary.version}`);
    console.log(`Manifest Version: ${manifestSummary.manifest_version}`);
    console.log(`Permissions: ${manifestSummary.permissions.join(', ')}`);
    console.log(`Host Permissions: ${manifestSummary.host_permissions.length} domains`);
    console.log(`Content Scripts: ${manifestSummary.content_scripts}`);
    console.log(`Background Script: ${manifestSummary.has_background ? 'Yes' : 'No'}`);
    console.log(`Popup: ${manifestSummary.has_popup ? 'Yes' : 'No'}`);
}

// Final results
console.log('\n📊 Validation Results:\n');
console.log(`Total files: ${validationResults.total}`);
console.log(`Passed: ${validationResults.passed}`);
console.log(`Failed: ${validationResults.failed}`);
console.log(`Security issues: ${securityIssues.length}`);

if (validationResults.failed === 0 && securityIssues.length === 0) {
    console.log('\n🎉 Extension validation PASSED! Ready for deployment.');
    process.exit(0);
} else {
    console.log('\n⚠️  Extension validation FAILED! Please fix the issues above.');
    process.exit(1);
}