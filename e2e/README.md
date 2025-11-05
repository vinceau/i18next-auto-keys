# End-to-End Tests for i18next-auto-keys

This directory contains comprehensive end-to-end tests that verify the complete workflow of the i18next-auto-keys package.

## What These Tests Do

The e2e tests verify the entire process from source code to working i18next translations:

1. **Source Transformation**: Verifies that string literals in message functions are correctly transformed to `i18next.t()` calls with auto-generated hash keys
2. **Translation File Generation**: Ensures that the webpack plugin generates valid JSON translation files
3. **i18next Integration**: Tests that i18next can actually load and use the generated translation files
4. **Real-world Scenarios**: Tests various message patterns including simple strings, parameterized messages, and complex interpolations

## Test Structure

```
e2e/
├── src/                           # Sample source files
│   ├── auth.messages.ts          # Authentication messages
│   ├── ui.messages.ts            # UI component messages
│   └── index.ts                  # Main entry point
├── tests/
│   └── e2e.test.ts               # Comprehensive e2e tests
├── webpack.config.js             # Webpack configuration for testing
├── package.json                  # E2E test dependencies
└── README.md                     # This file
```

## Test Coverage

### Source File Processing
- Simple message functions without parameters
- Parameterized messages with i18next `{{variable}}` syntax
- Multi-parameter messages
- `@noTranslate` annotation support
- Complex message scenarios

### Webpack Transformation
- Verifies `i18next.t()` call generation
- Checks hash key length and format (10 characters)
- Ensures parameter objects are correctly generated
- Confirms `@noTranslate` messages remain unchanged

### Translation File Generation
- Valid JSON output format
- Correct hash key to message mapping
- Preservation of i18next interpolation syntax (`{{variable}}`)
- Exclusion of `@noTranslate` messages

### i18next Integration
- Translation loading and resolution
- Simple message translation
- Parameter interpolation with single and multiple parameters
- Graceful handling of missing keys and parameters
- Execution of transformed code bundle

## Running the Tests

From the project root:

```bash
# Run e2e tests (builds package first)
npm run test:e2e

# Run e2e tests in watch mode
npm run test:e2e:watch

# Run all tests (unit + e2e)
npm run test:all
```

From the e2e directory:

```bash
cd e2e

# Install dependencies
npm install

# Run tests
npm test

# Run in watch mode
npm run test:watch

# Build the test bundle
npm run build
```

## Adding New Test Cases

To add new test scenarios:

1. **Add message files**: Create new `.messages.ts` files in `src/` following the existing pattern
2. **Update index.ts**: Export and use your new message functions
3. **Extend tests**: Add test cases in `e2e.test.ts` to verify your specific scenarios
4. **Update webpack config**: Modify `webpack.config.js` if you need different loader options

## Test Environment

- **Target**: Node.js environment for testing
- **i18next Version**: Latest compatible version (23.x)
- **Webpack**: Version 5+ with the built i18next-auto-keys loader and plugin
- **Jest**: Test runner with TypeScript support

## Example Test Scenarios

The tests verify real-world usage patterns:

```typescript
// Simple message
AuthMessages.title() 
// → i18next.t("a1b2c3d4e5")
// → "Authentication"

// Parameterized message
AuthMessages.welcome("John")
// → i18next.t("f6g7h8i9j0", { name: "John" })
// → "Welcome back, John!"

// Multi-parameter message
AuthMessages.resetEmailSent("user@example.com", 15)
// → i18next.t("k1l2m3n4o5", { email: "user@example.com", minutes: 15 })
// → "Password reset link sent to user@example.com. Expires in 15 minutes."
```

## Troubleshooting

### Common Issues

1. **Build failures**: Ensure the main package is built (`npm run build`) before running e2e tests
2. **Missing dependencies**: Run `npm install` in both the root and `e2e/` directories
3. **Timeout errors**: Webpack builds may take time; the tests have a 60-second timeout
4. **Transform errors**: Check that your message files follow the expected pattern (function returning string literal)

### Debugging

- Check `e2e/dist/bundle.js` to see the transformed code
- Examine `e2e/dist/locales/en.json` to verify translation file generation
- Use `npm run test:e2e:watch` for iterative development

## Contributing

When adding features to i18next-auto-keys:

1. Add corresponding test scenarios in the e2e tests
2. Update sample message files to cover new use cases
3. Ensure all e2e tests pass before submitting changes
4. Consider edge cases and error conditions
