# Build Architecture

## Bundle Structure

The package builds with a clean, simple architecture:

### Main Bundles
- `dist/index.js` - Complete webpack plugin + shared functionality (~10.1KB)
  - Webpack plugin and loaders
  - Shared transformer and utilities for CLI
- `dist/cli/generatePot.js` - Lightweight CLI tool (~5.3KB)
  - Imports shared functionality from `../index`

## Usage

### Standard Usage (Recommended)
Use the main entry point for webpack, and the optimized CLI for POT generation:

```javascript
// Webpack plugin usage
const { I18nextAutoKeyEmitPlugin } = require('i18next-auto-keys');

// CLI usage (imports shared functionality from main package)
npx i18next-auto-keys --include "**/*.ts" --output ./i18n/messages.pot
```

### Advanced Usage (Direct Access to Shared Functionality)
All shared functionality is available from the main package:

```javascript
// Import shared transformer and utilities directly from main package
const { 
  createI18nextAutoKeyTransformerFactory, 
  i18nStore,
  I18nextAutoKeyEmitPlugin 
} = require('i18next-auto-keys');
```

## Design Philosophy

1. **Optimized by Default**: CLI automatically uses shared bundles for maximum efficiency
2. **Self-Contained Webpack Plugin**: Main plugin bundle works independently
3. **Modular Architecture**: Shared bundles eliminate code duplication
4. **Zero Breaking Changes**: Existing users continue to work without changes

## Performance Benefits

- **CLI Bundle Size**: Reduced from 11.7KB to 5.3KB (55% reduction)
- **Total Size for Both Tools**: 15.4KB (10.1 + 5.3) vs. previous 21.4KB (9.7 + 11.7) = **28% reduction**
- **Code Deduplication**: Transformer logic exists in only one place (main bundle)
- **Simple Architecture**: No complex externals or separate shared bundles needed

## File Structure

```
dist/
├── index.js                    # 9.9KB - Complete webpack plugin + shared functionality
├── index.d.ts                  # TypeScript definitions
├── cli/
│   └── generatePot.js          # 5.3KB - Lightweight CLI (imports from ../index) 
└── [source maps and other artifacts]
```
