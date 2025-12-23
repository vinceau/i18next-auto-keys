# Quick Start: Rollup E2E Tests

## Installation

```bash
# Navigate to the rollup e2e directory
cd e2e/rollup

# Install dependencies
npm install
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Build the example (optional)
npm run build
```

## From Project Root

```bash
# Build the main package first
npm run build

# Run rollup e2e tests
npm run test:e2e:rollup

# Run all e2e tests (webpack + rollup)
npm run test:e2e
```

## Test Structure

```
tests/
├── e2e.test.ts       # Standard transformation tests
└── icu.e2e.test.ts   # ICU formatting tests
```

## What Gets Tested

### Standard Tests
- Message function transformation
- Hash key generation
- Parameter handling (named & indexed)
- Translation file generation
- @noTranslate annotations
- Runtime i18next integration

### ICU Tests
- Pluralization rules
- Number formatting
- Date formatting
- Select statements
- Complex multi-parameter messages

## Expected Output

After running tests, you'll see:
```
PASS  tests/e2e.test.ts
  i18next-auto-keys Rollup E2E Tests
    Configuration: default
      ✓ should transform string returns to i18next.t() calls
      ✓ should generate valid JSON translation file
      ✓ should return translated messages
    Configuration: indexedArguments
      ✓ should use indexed parameters
    ...

PASS  tests/icu.e2e.test.ts
  ICU Rollup E2E Tests
    Configuration: icuNamed
      ✓ should handle ICU pluralization
      ✓ should handle ICU number formatting
    ...
```

## Build Artifacts

Tests generate temporary artifacts in `dist/`:
```
dist/
├── bundle-default.js
├── bundle-default.js.map
├── bundle-icu-named.js
├── locales/
│   ├── en.json
│   ├── icu-named-en.json
│   └── icu-indexed-en.json
```

These are automatically cleaned up after tests complete.

## Troubleshooting

### "Cannot find module 'i18next-auto-keys'"

**Solution**: Build the main package first:
```bash
cd ../..  # Go to project root
npm run build
cd e2e/rollup
npm install
```

### "ENOENT: no such file or directory"

**Solution**: Ensure the dist directory structure exists:
```bash
mkdir -p dist/locales
```

### Tests timeout

**Solution**: Increase timeout in jest.config.js:
```javascript
testTimeout: 60000  // Increase to 60 seconds
```

### Module resolution errors

**Solution**: Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

- Review [README.md](./README.md) for detailed documentation
- Compare with [Webpack tests](../webpack/README.md)
- Read [E2E Comparison](../E2E_COMPARISON.md) for differences
- Check [Rollup Plugin Usage](../../USAGE_VITE_ROLLUP.md) for integration guide

