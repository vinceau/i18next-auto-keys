#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Clean up extra build artifacts, keeping only index.* files
 */
function cleanBuildArtifacts(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively clean subdirectories
        cleanBuildArtifacts(fullPath);
        
        // Remove empty directories
        try {
          fs.rmdirSync(fullPath);
        } catch (e) {
          // Directory not empty, that's ok
        }
      } else if (entry.isFile()) {
        // Remove .d.ts and .d.ts.map files that aren't index.*
        if (entry.name.endsWith('.d.ts') || entry.name.endsWith('.d.ts.map')) {
          if (!entry.name.startsWith('index.')) {
            fs.unlinkSync(fullPath);
            console.log(`  Removed: ${path.relative(path.join(__dirname, '..'), fullPath)}`);
          }
        }
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Error cleaning ${dir}:`, error.message);
    }
  }
}

const clean = () => {
  console.log('Cleaning build artifacts...');
  const distDir = path.join(__dirname, '..', 'dist');
  cleanBuildArtifacts(distDir);
  console.log('Build artifacts cleaned successfully');
}

clean();