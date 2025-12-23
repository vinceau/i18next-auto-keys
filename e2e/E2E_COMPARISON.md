# E2E Test Comparison: Webpack vs Rollup

This document provides a comparison between the Webpack and Rollup end-to-end test implementations.

## Overview

Both test suites verify the complete i18next-auto-keys workflow:
1. Source transformation (message functions → i18next.t() calls)
2. Translation file generation
3. Runtime behavior with i18next

## Directory Structure Comparison

```
e2e/
├── webpack/                          ├── rollup/
│   ├── src/                          │   ├── src/
│   │   ├── auth.messages.ts         │   │   ├── auth.messages.ts
│   │   ├── auth-indexed.messages.ts │   │   ├── auth-indexed.messages.ts
│   │   ├── ui.messages.ts           │   │   ├── ui.messages.ts
│   │   ├── ui-indexed.messages.ts   │   │   ├── ui-indexed.messages.ts
│   │   ├── context.messages.ts      │   │   ├── context.messages.ts
│   │   ├── replay-browser.messages.ts│   │   ├── replay-browser.messages.ts
│   │   ├── replay-browser-indexed... │   │   ├── replay-browser-indexed...
│   │   ├── index.ts                 │   │   ├── index.ts
│   │   └── icu-index.ts             │   │   └── icu-index.ts
│   ├── tests/                        │   ├── tests/
│   │   ├── e2e.test.ts              │   │   ├── e2e.test.ts
│   │   ├── icu.e2e.test.ts          │   │   ├── icu.e2e.test.ts
│   │   ├── cli.e2e.test.ts          │   │   └── (no CLI tests - same CLI)
│   │   └── config.simple.e2e.test.ts│   │
│   ├── webpack-configs.ts           │   ├── rollup-configs.ts
│   ├── webpack.config.js            │   ├── rollup.config.js
│   ├── package.json                  │   ├── package.json
│   ├── jest.config.js               │   ├── jest.config.js
│   ├── tsconfig.json                │   ├── tsconfig.json
│   └── README.md                    │   └── README.md
```

## Key Differences

### 1. Build Tool Integration

| Aspect | Webpack | Rollup |
|--------|---------|--------|
| Plugin Type | Loader + Plugin | Pure Plugin |
| Configuration API | `webpack()` function | `rollup()` function |
| Module System | CommonJS default | ESM/CJS/IIFE configurable |
| Build Process | Single-pass | Multi-pass (rollup + write) |

### 2. Configuration Files

**Webpack** (`webpack-configs.ts`):
```typescript
createWebpackConfig({
  configName: "default",
  include: /\.messages\.(ts|tsx)$/,
  // Webpack-specific options
  target: "node",
  minimize: false,
})
```

**Rollup** (`rollup-configs.ts`):
```typescript
createRollupConfig({
  configName: "default",
  include: /\.messages\.(ts|tsx)$/,
  // Rollup-specific options
  outputFormat: "cjs",
})
```

### 3. Plugin Usage

**Webpack**:
```javascript
// Uses two separate components:
// 1. Loader for transformation
use: [{
  loader: "i18next-auto-keys",
  options: { include, argMode, setDefaultValue }
}]

// 2. Plugin for emitting JSON
plugins: [
  new I18nextAutoKeyEmitPlugin({
    jsonOutputPath: "locales/en.json"
  })
]
```

**Rollup**:
```javascript
// Single plugin handles both:
plugins: [
  i18nextAutoKeyRollupPlugin({
    include: [include],
    argMode,
    setDefaultValue,
    jsonOutputPath: "locales/en.json"
  })
]
```

### 4. Build API Usage

**Webpack**:
```typescript
const stats = await webpackAsync([config]);
if (stats && stats.hasErrors()) {
  // Handle errors
}
```

**Rollup**:
```typescript
const bundle = await rollup(config);
await bundle.write(config.output);
await bundle.close();
```

### 5. Dependencies

**Webpack** (`e2e/webpack/package.json`):
```json
{
  "devDependencies": {
    "webpack": "^5",
    "webpack-cli": "^6.0.1",
    "ts-loader": "^9.5.4"
  }
}
```

**Rollup** (`e2e/rollup/package.json`):
```json
{
  "devDependencies": {
    "rollup": "^4.28.1",
    "@rollup/plugin-typescript": "^12.1.1",
    "@rollup/plugin-node-resolve": "^15.3.0",
    "@rollup/plugin-commonjs": "^28.0.2"
  }
}
```

## Test Coverage

Both test suites cover identical functionality:

### Standard Tests (`e2e.test.ts`)
- ✅ String transformation to i18next.t() calls
- ✅ Hash key generation (default 10 characters)
- ✅ Parameter handling (named and indexed)
- ✅ @noTranslate annotation support
- ✅ Translation file generation
- ✅ Multiple configuration scenarios
- ✅ Runtime behavior verification

### ICU Tests (`icu.e2e.test.ts`)
- ✅ ICU pluralization
- ✅ ICU number formatting
- ✅ ICU date formatting
- ✅ ICU select statements
- ✅ Complex multi-parameter ICU messages
- ✅ Named vs indexed parameter modes

### Additional Tests (Webpack only)
- `cli.e2e.test.ts`: CLI functionality tests (shared between webpack and rollup)
- `config.simple.e2e.test.ts`: Configuration file tests

## Shared Components

Both test suites use identical:
1. **Source files**: Same message files in `src/`
2. **Test structure**: Similar describe/it organization
3. **Assertions**: Same expectations for transformations
4. **Runtime tests**: Same i18next initialization and testing

## Running Tests

```bash
# Run all e2e tests (webpack + rollup)
npm run test:e2e

# Run webpack tests only
npm run test:e2e:webpack

# Run rollup tests only
npm run test:e2e:rollup
```

## Performance Considerations

| Aspect | Webpack | Rollup |
|--------|---------|--------|
| Build Speed | Moderate | Fast |
| Bundle Size | Larger (includes runtime) | Smaller (tree-shaken) |
| Test Execution | ~30-60s | ~30-60s |
| Memory Usage | Higher | Lower |

## Which to Use?

- **Webpack tests**: Verify webpack loader/plugin integration
- **Rollup tests**: Verify rollup/vite plugin integration
- **Both**: Comprehensive verification across build tools

## Future Improvements

Potential enhancements for both test suites:

1. **Source maps**: Verify source map generation and accuracy
2. **Watch mode**: Test file watching and incremental builds
3. **Cache**: Test build caching behavior
4. **Error handling**: More comprehensive error scenario tests
5. **Performance**: Add performance benchmarks
6. **Vite-specific**: Add Vite dev server tests for rollup plugin

## Conclusion

The Rollup e2e tests mirror the Webpack tests while adapting to Rollup's plugin architecture. Both provide comprehensive verification of i18next-auto-keys functionality, ensuring consistent behavior across different build tools.

