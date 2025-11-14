# Vite & Rollup Support - Implementation Summary

## Overview

Added support for **Vite** and **Rollup** bundlers to `i18next-auto-keys`. The plugin now works with:
- ✅ Webpack 5+ (existing)
- ✅ Vite (new)
- ✅ Rollup 4+ (new)

## Key Insight

Vite uses Rollup under the hood for production builds, and Vite's plugin API is a **superset** of Rollup's plugin API. This means we can create a **single unified plugin** that works with both Vite and Rollup!

## What Changed

### 1. New Rollup/Vite Plugin

**File**: `src/plugins/i18nextAutoKeyRollupPlugin.ts`

A unified plugin that works with both Rollup and Vite:
- Uses standard Rollup plugin hooks (`buildStart`, `transform`, `generateBundle`)
- Fully compatible with Vite's plugin system
- Simpler API than Webpack (single plugin vs loader + plugin)

**Key Features:**
- Transforms TypeScript files using the existing AST transformer
- Emits JSON translation files
- Watches config file for changes
- Supports all existing options (argMode, setDefaultValue, debug, etc.)

### 2. Updated Package.json

**Changes:**
- Added `rollup` and `vite` as dev dependencies
- Added peer dependency metadata marking webpack/rollup/vite as optional
- Updated keywords to include "rollup" and "vite"

### 3. Comprehensive Documentation

**New Files:**
- `USAGE_VITE_ROLLUP.md` - Complete guide for Vite and Rollup usage
- `examples/vite-example/vite.config.js` - Example Vite configuration
- `examples/rollup-example/rollup.config.js` - Example Rollup configuration
- `examples/README.md` - Overview of all examples

**Updated Files:**
- `README.md` - Added Vite/Rollup sections and updated requirements
- `src/index.ts` - Export new Rollup plugin

### 4. Test Suite

**File**: `src/plugins/tests/i18nextAutoKeyRollupPlugin.test.ts`

Comprehensive test suite covering:
- Plugin structure and lifecycle
- File filtering (include patterns)
- TypeScript transformation
- JSON emission
- All plugin options (argMode, setDefaultValue, debug, topLevelKey)
- Edge cases (empty store, special characters, unicode)
- Full workflow integration

## Architecture

### Core Transformation (Bundler-Agnostic) ✅
```
TypeScript Source → AST Transformer → Transformed Code + i18nStore
```

This core logic is **already bundler-agnostic** and requires no changes!

### Integration Layer (Bundler-Specific)

**Webpack (Existing):**
```
Loader: Applies transformation to files
  ↓
Plugin: Emits JSON from i18nStore
```

**Vite/Rollup (New):**
```
Single Plugin with 3 hooks:
  1. buildStart → Clear store
  2. transform → Apply transformation  
  3. generateBundle → Emit JSON
```

## Usage Comparison

### Webpack
```javascript
module.exports = {
  module: {
    rules: [{
      test: /\.messages\.(ts|tsx)$/,
      use: 'i18next-auto-keys',
    }]
  },
  plugins: [
    new I18nextAutoKeyEmitPlugin({
      jsonOutputPath: 'locales/en.json',
    })
  ]
};
```

### Vite/Rollup
```javascript
export default {
  plugins: [
    i18nextAutoKeyRollupPlugin({
      jsonOutputPath: 'locales/en.json',
    })
  ]
};
```

The Vite/Rollup approach is **simpler** because it uses a single plugin instead of a loader + plugin combination.

## Benefits

1. **No code changes required** - Message files and application code remain identical
2. **Unified API** - Same plugin works for both Vite and Rollup
3. **Simpler configuration** - Single plugin vs loader + plugin
4. **Same features** - All existing functionality preserved
5. **Better developer experience** - Works with Vite's HMR and dev server

## Migration Path

For users migrating from Webpack to Vite:

1. **Replace Webpack configuration:**
   ```javascript
   // Remove webpack.config.js loader and plugin
   ```

2. **Add Vite configuration:**
   ```javascript
   // vite.config.js
   import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys';
   
   export default {
     plugins: [
       i18nextAutoKeyRollupPlugin({
         jsonOutputPath: 'locales/en.json',
       })
     ]
   };
   ```

3. **Done!** - No changes to message files or application code

## Technical Details

### Why This Works

1. **Vite's Plugin API** is a superset of Rollup's plugin API
2. **Common hooks** work in both:
   - `buildStart` - Initialization (build-only in Vite)
   - `transform` - File transformation (works in dev and build)
   - `generateBundle` - Asset emission (build-only in Vite)

3. **Dev vs Build in Vite:**
   - **Dev mode**: Only `transform` hook runs (fast transforms with esbuild)
   - **Build mode**: All hooks run (uses Rollup internally)

### Type Safety

Full TypeScript support with exported types:
```typescript
import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys';
import type { I18nextAutoKeyRollupPluginOptions } from 'i18next-auto-keys';
```

## Testing

The implementation includes:
- ✅ Unit tests for plugin lifecycle
- ✅ Integration tests for full workflow
- ✅ Edge case coverage
- ✅ Type checking via TypeScript build
- ✅ Build verification (npm run build)

## Future Enhancements

Possible future improvements:
- [ ] Source map support for Rollup plugin
- [ ] esbuild plugin for even faster Vite dev transforms
- [ ] Additional bundler support (Parcel, etc.)

## Files Modified/Created

### Created:
- `src/plugins/i18nextAutoKeyRollupPlugin.ts`
- `src/plugins/tests/i18nextAutoKeyRollupPlugin.test.ts`
- `USAGE_VITE_ROLLUP.md`
- `CHANGELOG_VITE_ROLLUP.md`
- `examples/vite-example/vite.config.js`
- `examples/rollup-example/rollup.config.js`
- `examples/README.md`

### Modified:
- `package.json` (dependencies, keywords, peer dependencies)
- `src/index.ts` (exports)
- `README.md` (requirements, setup instructions)

## Backwards Compatibility

✅ **100% backwards compatible** - All existing Webpack functionality remains unchanged and fully supported.

