# End-to-End Tests

This directory contains comprehensive tests that verify the complete workflow of i18next-auto-keys, from source transformation to working translations.

## Bundler Support

Tests are provided for three major bundlers:
- **Webpack** - Full webpack-loader integration
- **Rollup** - Native Rollup plugin support
- **Vite** - Works seamlessly via Rollup plugin (Vite uses Rollup internally)

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

## Test Structure

```
e2e/
├── fixtures/
│   ├── messages/
│   │   ├── auth.messages.ts              # Standard auth messages
│   │   ├── auth-indexed.messages.ts      # Indexed parameter version
│   │   ├── ui.messages.ts                # UI messages
│   │   ├── ui-indexed.messages.ts        # Indexed parameter version
│   │   ├── replay-browser.messages.ts    # ICU messages (named)
│   │   ├── replay-browser-indexed.messages.ts  # ICU messages (indexed)
│   │   └── context.messages.ts           # Context disambiguation messages
│   ├── index.ts                          # Standard test entry point
│   └── icu-index.ts                      # ICU test entry point
├── tests/
│   ├── cli/                              # CLI tool tests
│   │   ├── cli.e2e.test.ts
│   │   └── config.e2e.test.ts
│   ├── webpack/                          # Webpack-specific tests
│   │   ├── webpack-configs.ts
│   │   ├── e2e.test.ts
│   │   └── icu.e2e.test.ts
│   ├── rollup/                           # Rollup-specific tests
│   │   ├── rollup-configs.ts
│   │   ├── e2e.test.ts
│   │   └── icu.e2e.test.ts
│   └── vite/                             # Vite-specific tests
│       ├── vite-configs.ts
│       ├── e2e.test.ts
│       └── icu.e2e.test.ts
├── webpack.config.js                     # Example Webpack config
├── rollup.config.js                      # Example Rollup config
├── vite.config.js                        # Example Vite config
└── package.json
```

## Running Tests

```bash
# From project root
npm run test:e2e

# From e2e directory
cd e2e && npm test

# Run specific bundler tests
npm run test:webpack   # Webpack only
npm run test:rollup    # Rollup only
npm run test:vite      # Vite only
npm run test:cli       # CLI only

# Build bundles without running tests
npm run build:webpack
npm run build:rollup
npm run build:vite

# Watch mode
npm run test:watch
```

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
