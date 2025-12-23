# End-to-End Tests for Rollup

This directory contains comprehensive tests that verify the complete workflow of i18next-auto-keys with Rollup, from source transformation to working translations.

## Test Coverage

### Standard Features
- **String Transformation**: Converts message functions to `i18next.t()` calls with generated hash keys
- **Translation Generation**: Creates valid JSON translation files
- **Parameter Handling**: Tests simple and multi-parameter messages
- **NoTranslate Support**: Verifies `@noTranslate` annotations are respected

### Advanced Features
- **Indexed Arguments**: Tests both named (`{name}`) and indexed (`{0}`) parameter modes
- **ICU Formatting**: Tests International Components for Unicode features:
  - Pluralization: `{count, plural, one {# item} other {# items}}`
  - Number formatting: `{value, number, percent}`
  - Date formatting: `{date, date, short}`
  - Select statements: `{status, select, online {Online} offline {Offline}}`

## Test Files

```
e2e/rollup/
├── src/
│   ├── auth.messages.ts              # Standard auth messages
│   ├── auth-indexed.messages.ts      # Indexed parameter version
│   ├── ui.messages.ts                # UI messages
│   ├── ui-indexed.messages.ts        # Indexed parameter version
│   ├── replay-browser.messages.ts    # ICU messages (named)
│   ├── replay-browser-indexed.messages.ts  # ICU messages (indexed)
│   ├── context.messages.ts           # Translation context test messages
│   ├── index.ts                      # Standard test entry point
│   └── icu-index.ts                  # ICU test entry point
└── tests/
    ├── e2e.test.ts                   # Standard + indexed tests
    └── icu.e2e.test.ts               # ICU formatting tests
```

## Running Tests

```bash
# From project root
npm run test:e2e:rollup

# From e2e/rollup directory
cd e2e/rollup && npm test

# Install dependencies first if needed
cd e2e/rollup && npm install
```

## Test Configurations

The tests use programmatic Rollup configurations defined in `rollup-configs.ts`:

- **default**: Standard configuration with named parameters
- **shortHashes**: Uses shorter hash keys (configured via cosmiconfig)
- **longHashes**: Uses longer hash keys (configured via cosmiconfig)
- **withDefaultValues**: Includes original strings as defaultValue in i18next.t() calls
- **production**: Production mode configuration
- **strictInclude**: Only processes files matching strict pattern (auth.messages.ts)
- **noSourcemaps**: Disables source map generation
- **customLoaderOptions**: Tests custom loader options
- **indexedArguments**: Uses indexed parameters (`{0}`, `{1}`) instead of named
- **translationContext**: Tests translation context feature

## Example Transformations

**Standard Messages:**
```typescript
AuthMessages.welcome("John")
// → i18next.t("f6g7h8i9j0", { name: "John" })
// → "Welcome back, John!"
```

**Indexed Parameters:**
```typescript
AuthMessages.welcome("John")  // using indexed messages
// → i18next.t("f6g7h8i9j0", { 0: "John" })
// → "Welcome back, John!"
```

**ICU Formatting:**
```typescript
ReplayMessages.fileCount(5)
// → i18next.t("a1b2c3d4e5", { count: 5 })
// → "5 files found." (uses ICU pluralization)
```

## Differences from Webpack E2E Tests

This Rollup implementation mirrors the Webpack e2e tests but uses Rollup-specific:

1. **Build Process**: Uses Rollup API instead of Webpack API
2. **Plugin System**: Uses `i18nextAutoKeyRollupPlugin` instead of webpack loader
3. **Configuration**: Rollup configuration format instead of webpack.config.js
4. **Module Format**: Outputs CommonJS by default (configurable to ESM or IIFE)

## Key Features Tested

### Transformation
- ✅ String returns transformed to `i18next.t()` calls
- ✅ Hash keys of correct length (default: 10 characters)
- ✅ Parameter objects included for parameterized messages
- ✅ `@noTranslate` functions remain unchanged

### Translation Files
- ✅ Valid JSON structure
- ✅ Hash keys match transformation output
- ✅ i18next interpolation syntax preserved
- ✅ ICU formatting syntax preserved
- ✅ No @noTranslate messages included

### Runtime Behavior
- ✅ Translated messages return correct strings
- ✅ Parameters interpolated correctly
- ✅ ICU pluralization works with i18next-icu
- ✅ ICU number and date formatting
- ✅ ICU select statements

## Configuration Notes

The tests respect the global configuration from cosmiconfig (e.g., `i18next-auto-keys.config.json`) for settings like:
- `hashLength`: Length of generated hash keys (default: 10)
- `jsonIndentSpaces`: Indentation in generated JSON files
- `topLevelKey`: Optional top-level key to wrap translations

Individual test configurations can override plugin-specific options like:
- `include`: File patterns to process
- `argMode`: "named" or "indexed" parameter mode
- `setDefaultValue`: Include original string as defaultValue
- `debug`: Wrap strings with "~~" markers for debugging

## Troubleshooting

### Tests Fail with "Cannot find module"
Make sure dependencies are installed:
```bash
cd e2e/rollup && npm install
```

### Global State Issues
The transformer uses a global store. If tests fail intermittently, it may be due to state leakage. The tests clear `require.cache` between configurations to mitigate this.

### Build Artifacts
Tests automatically clean up build artifacts (`dist/` directory) before and after running. If you need to inspect the built output, check the `dist/` directory during test execution or disable cleanup temporarily.

## Adding New Tests

To add new test scenarios:

1. Create new message files in `src/` (follow naming convention: `*.messages.ts`)
2. Add configuration in `rollup-configs.ts` if needed
3. Add test cases in `tests/e2e.test.ts` or `tests/icu.e2e.test.ts`
4. Update this README with the new test scenario

## Related Documentation

- [Rollup Plugin Usage](../../USAGE_VITE_ROLLUP.md)
- [Webpack E2E Tests](../webpack/README.md)
- [Implementation Guide](../../IMPLEMENTATION_GUIDE.md)

