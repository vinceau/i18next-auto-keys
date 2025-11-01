#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

// Read webpack config
const webpackConfigPath = path.join(__dirname, '..', 'webpack.build.config.js');
const webpackConfig = require(webpackConfigPath);

/**
 * Build TypeScript declarations
 */
function buildTypeDeclarations() {
  return new Promise((resolve, reject) => {
    console.log('📝 Building TypeScript declarations...');
    
    // Extract external dependencies from webpack config
    const externals = Object.keys(webpackConfig.externals || {});
    console.log(`   External dependencies: [${externals.join(', ')}]`);

    // Build the dts-bundle-generator command
    const inputFile = 'src/index.ts';
    const outputFile = 'dist/index.d.ts';
    
    const command = [
      'dts-bundle-generator',
      '-o', outputFile,
      inputFile,
      '--no-check'
    ];

    // Add external inlines if there are any
    if (externals.length > 0) {
      command.push('--external-inlines', externals.join(','));
    }

    try {
      execSync(command.join(' '), { 
        stdio: 'pipe',
        cwd: path.join(__dirname, '..')
      });
      console.log('   ✅ TypeScript declarations built successfully');
      resolve();
    } catch (error) {
      console.error('   ❌ Failed to build TypeScript declarations');
      reject(error);
    }
  });
}

buildTypeDeclarations();