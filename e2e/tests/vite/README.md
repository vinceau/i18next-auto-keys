# Vite E2E Tests

This directory contains end-to-end tests for i18next-auto-keys with Vite as the bundler.

## Overview

These tests verify that the `i18nextAutoKeyRollupPlugin` works seamlessly with Vite. Since Vite uses Rollup under the hood for production builds and supports Rollup plugins natively, the same plugin works for both Rollup and Vite without any modifications.

## Test Structure

```
tests/vite/
├── vite-configs.ts         # Programmatic Vite configurations for testing
├── e2e.test.ts             # Standard feature tests
└── icu.e2e.test.ts         # ICU formatting tests
```

## Test Configurations

The tests use programmatic Vite configurations to test various scenarios:

- **default**: Standard configuration with named arguments
- **shortHashes**: Tests with shorter hash keys
- **longHashes**: Tests with longer hash keys
- **withDefaultValues**: Includes original strings as defaultValue in t() calls
- **production**: Production-optimized build
- **strictInclude**: Tests selective file inclusion (only auth messages)
- **noSourcemaps**: Build without source maps
- **customLoaderOptions**: Custom loader configuration
- **indexedArguments**: Uses indexed parameters ({{0}}, {{1}}) instead of named
- **translationContext**: Tests translation context disambiguation

## Running Tests

```bash
# From e2e directory
npm run test:vite

# Run all tests including Vite
npm test

# Build Vite bundles only
npm run build:vite

# Watch mode
npm run test:watch -- tests/vite
```

## Test Coverage

### Standard Features (e2e.test.ts)
- ✅ String transformation to `i18next.t()` calls
- ✅ Hash key generation with configurable length
- ✅ Parameter handling (named and indexed modes)
- ✅ @noTranslate annotation support
- ✅ Translation file generation (JSON)
- ✅ Source map generation and validation
- ✅ Include/exclude pattern filtering
- ✅ End-to-end function execution

### ICU Features (icu.e2e.test.ts)
- ✅ ICU pluralization: `{count, plural, one {# item} other {# items}}`
- ✅ ICU number formatting: `{value, number, percent}`
- ✅ ICU date formatting: `{date, date, short}`
- ✅ ICU select statements: `{status, select, online {Online} offline {Offline}}`
- ✅ Complex multi-parameter ICU messages
- ✅ Mixed ICU and regular interpolation

## Key Differences from Rollup Tests

While the test structure is identical to the Rollup tests, there are some subtle differences:

1. **Build API**: Uses Vite's `build()` function instead of Rollup's `rollup()` API
2. **Configuration**: Uses Vite's `InlineConfig` type with `build.lib` configuration
3. **Plugin Integration**: The plugin is added to Vite's `plugins` array (same as Rollup)
4. **Bundle Format**: Configured via `build.lib.formats` instead of Rollup's `output.format`

## Example Vite Configuration

See `vite.config.js` in the e2e root for a complete example:

```javascript
import { defineConfig } from "vite";
import { i18nextAutoKeyRollupPlugin } from "i18next-auto-keys";

export default defineConfig({
  build: {
    lib: {
      entry: "./src/index.ts",
      formats: ["cjs"],
    },
  },
  plugins: [
    i18nextAutoKeyRollupPlugin({
      include: [/\.messages\.(ts|tsx)$/],
      argMode: "named",
      jsonOutputPath: "locales/en.json",
    }),
  ],
});
```

## Development Notes

### Plugin Compatibility

The `i18nextAutoKeyRollupPlugin` works with Vite because:
- Vite's plugin API is a superset of Rollup's plugin API
- We use only common hooks: `buildStart`, `transform`, `generateBundle`
- These hooks work identically in both Rollup and Vite build processes

### Test Isolation

Each test configuration runs in isolation with:
- Separate build artifacts
- Cleared require cache between tests
- Fresh i18next initialization
- Cleanup after test completion

### Known Limitations

- **Global State**: The transformer uses a global store that persists across configurations in the same process. This is a known limitation documented in the main plugin.
- **Module Isolation**: Unlike Webpack's `__webpack_require__` system, Vite/Rollup bundles share global state when loaded in the same Node.js process.

## Troubleshooting

### Tests Fail After Package Changes

Clear the dist directory and require cache:

```bash
npm run clean
npm test
```

### Source Map Issues

Ensure `sourcemap: true` is set in Vite configuration:

```javascript
build: {
  sourcemap: true,
}
```

### Translation File Not Generated

Verify that:
1. Message files match the `include` pattern
2. The `jsonOutputPath` is correctly specified
3. The output directory exists and is writable

## Related Documentation

- [Rollup Tests](../rollup/README.md) - Similar tests using Rollup directly
- [Webpack Tests](../webpack/README.md) - Webpack-specific tests
- [Main E2E README](../../README.md) - Overview of all E2E tests
- [Vite Plugin API](https://vitejs.dev/guide/api-plugin.html) - Official Vite plugin documentation

