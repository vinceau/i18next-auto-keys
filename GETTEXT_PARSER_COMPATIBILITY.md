# gettext-parser Compatibility

## Overview

The `I18nEmitPlugin` supports POT file generation via the optional `gettext-parser` dependency. Our plugin is compatible with **both versions**:

- **gettext-parser v7.x and below** (CommonJS)
- **gettext-parser v8.x and above** (ESM-only)

## Automatic Version Detection

The plugin automatically detects which version you have installed and uses the appropriate loading method:

```javascript
// Works with BOTH versions automatically
const plugin = new I18nEmitPlugin({
  jsonOutputPath: "i18n/messages.json",
  potOutputPath: "i18n/messages.pot"  // POT generation is optional
});
```

## Installation Options

### Option 1: Latest Version (Recommended)
```bash
npm install --save-dev gettext-parser@^8.0.0
```

### Option 2: Legacy Version (if needed)
```bash
npm install --save-dev gettext-parser@^7.0.1
```

## How It Works

The plugin uses a smart loading strategy:

1. **Try CommonJS first** (`require("gettext-parser")`)
   - Works for v7.x and below

2. **Fallback to ESM** (`import("gettext-parser")`)
   - Works for v8.x and above
   - Uses dynamic import for compatibility

3. **Graceful degradation**
   - If neither works, POT generation is skipped
   - JSON generation always works regardless

## Type Definitions

Install the corresponding type definitions:

```bash
# For gettext-parser v8.x+
npm install --save-dev @types/gettext-parser@^8.0.0

# For gettext-parser v7.x
npm install --save-dev @types/gettext-parser@^7.0.0
```

## Troubleshooting

### "gettext-parser not available" in tests
If you see this warning in webpack test environments, it's usually due to memory filesystem limitations. In real webpack builds, the loading works correctly.

### ESM Import Errors
If you encounter ESM import issues:
1. Ensure you're using Node.js 14+ (for dynamic import support)
2. Verify `gettext-parser` is installed correctly
3. Check that your webpack configuration supports async plugin hooks

## Migration Guide

### From v7 to v8
No code changes needed! Simply update your package.json:

```bash
npm uninstall gettext-parser @types/gettext-parser
npm install --save-dev gettext-parser@^8.0.0 @types/gettext-parser@^8.0.0
```

The plugin will automatically detect the new version and use ESM loading.

### Staying on v7
If you prefer to stay on v7.x (CommonJS), that's fully supported:

```bash
npm install --save-dev gettext-parser@^7.0.1 @types/gettext-parser@^7.0.0
```

## Performance Notes

- **First compilation**: Slight overhead for version detection
- **Subsequent compilations**: Results are cached, no performance impact
- **No gettext-parser**: Zero overhead, falls back gracefully
