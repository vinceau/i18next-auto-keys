# i18next-auto-keys

[![npm version](https://img.shields.io/npm/v/i18next-auto-keys.svg?style=flat)](https://npmjs.org/package/i18next-auto-keys "View this project on npm")
[![Build Status](https://github.com/vinceau/i18next-auto-keys/workflows/build/badge.svg)](https://github.com/vinceau/i18next-auto-keys/actions?workflow=build)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Automatic translation key generation for i18next** - No more manual key management!

`i18next-auto-keys` is a webpack loader and plugin that automatically extracts string literals from your code and replaces them with `i18next.t()` calls using auto-generated hash keys. Perfect for developers who want to internationalize their applications without the overhead of manually managing translation keys.

## ✨ Features

- 🔄 **Automatic key generation** - Hash-based keys generated from source strings
- 🎯 **Zero manual key management** - Write strings naturally, get i18n automatically
- 📦 **Webpack integration** - Seamless webpack loader and plugin
- 🔧 **TypeScript support** - Full TypeScript AST transformation
- 📄 **Multiple output formats** - JSON for runtime, POT files for translators
- 🎨 **Flexible parameter handling** - Array or named parameter modes
- 🛠️ **CLI tools** - Generate POT files and convert PO to JSON independently

## 📋 Requirements

- Node.js 16+ 
- Webpack 5+
- TypeScript 4+ (for TypeScript projects)

## 📦 Installation

```bash
npm install --save-dev i18next-auto-keys
npm install --save i18next
```

Optional (for CLI POT/PO conversion):
```bash
npm install --save-dev gettext-parser
```

## 🚀 Quick Start

### 1. Write your code naturally

```typescript
// src/components/LoginForm.messages.ts
export const LoginMessages = {
  welcomeTitle: (): string => "Welcome Back!",
  loginButton: (): string => "Sign In",
  forgotPassword: (): string => "Forgot Password?",
  errorInvalid: (email: string): string => `Invalid email: {{email}}`,
};
```

### 2. Configure webpack

```javascript
// webpack.config.js
const { I18nextAutoKeyEmitPlugin } = require('i18next-auto-keys');

module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          'ts-loader', // or esbuild-loader
          {
            loader: 'i18next-auto-keys',
            options: {
              include: /\.messages\.(ts|tsx)$/, // Only process message files
              hashLength: 10,
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new I18nextAutoKeyEmitPlugin({
      jsonOutputPath: 'locales/en.json',
      projectIdVersion: 'my-app 1.0.0'
    })
  ]
};
```

### 3. Generated output

The loader automatically transforms your code:

```typescript
// After transformation
import i18next from "i18next";

export const LoginMessages = {
  welcomeTitle: (): string => i18next.t("a1b2c3d4e5"),
  loginButton: (): string => i18next.t("f6g7h8i9j0"),
  forgotPassword: (): string => i18next.t("k1l2m3n4o5"),
  errorInvalid: (email: string): string => i18next.t("p6q7r8s9t0", { email }),
};
```

And generates translation files:

```json
// dist/locales/en.json
{
  "a1b2c3d4e5": "Welcome Back!",
  "f6g7h8i9j0": "Sign In", 
  "k1l2m3n4o5": "Forgot Password?",
  "p6q7r8s9t0": "Invalid email: {{email}}"
}
```

## ⚙️ Configuration

### Loader Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `include` | `RegExp \| RegExp[]` | **Required** | Pattern(s) to match files for processing |
| `hashLength` | `number` | `10` | Length of generated hash keys (minimum 10) |
| `argMode` | `'array' \| 'named'` | `'named'` | How to pass parameters to `i18next.t()` |
| `sourcemap` | `boolean` | `false` | Generate source maps |

### Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `jsonOutputPath` | `string` | **Required** | Path for JSON translation file |
| `topLevelKey` | `string` | `undefined` | Wrap translations under a top-level key |

## ⚠️ Important: Parameter Handling

**Do NOT use JavaScript string interpolation (`${}`) in your message functions!**

```typescript
// ❌ WRONG - Don't do this
export const Messages = {
  greeting: (name: string): string => `Hello ${name}!`,           // String changes = unstable hash
  status: (count: number): string => `You have ${count} items`,   // i18next can't interpolate
};

// ✅ CORRECT - Do this instead  
export const Messages = {
  greeting: (name: string): string => `Hello {{name}}!`,          // Stable string for hashing
  status: (count: number): string => `You have {{count}} items`,  // i18next handles interpolation
};
```

**Why this matters:**

1. **Stable Hashing**: The loader generates hash keys from the literal string content. If you use `${variable}`, the string content changes based on runtime values, making hash generation impossible.

2. **i18next Interpolation**: The `{{variable}}` syntax is i18next's standard interpolation format, allowing translators to reorder parameters and apply formatting in different languages.

3. **Translation Flexibility**: Translators can modify parameter placement: `"Hello {{name}}!"` → `"{{name}} さん、こんにちは！"` (Japanese)

## 🎯 Usage Patterns

### Message Files Organization

Create dedicated message files for better organization:

```typescript
// src/pages/auth/auth.messages.ts
export const AuthMessages = {
  // Simple messages
  title: (): string => "Authentication",
  subtitle: (): string => "Please sign in to continue",
  
  // Messages with parameters
  welcome: (name: string): string => `Welcome back, {{name}}!`,
  attemptsLeft: (count: number): string => `{{count}} attempts remaining`,
  
  // Complex messages
  resetEmail: (email: string, minutes: number): string => 
    `Password reset link sent to {{email}}. Expires in {{minutes}} minutes.`,
};
```

### Parameter Modes

#### Named Mode (Default)
```typescript
// Source
greeting: (name: string, time: string): string => `Hello {{name}}, good {{time}}!`

// Transformed to
greeting: (name: string, time: string): string => i18next.t("abc123def4", { name, time })

// JSON output
{ "abc123def4": "Hello {{name}}, good {{time}}!" }
```

#### Array Mode
```typescript
// webpack.config.js
{
  loader: 'i18next-auto-keys',
  options: {
    argMode: 'array'
  }
}

// Transformed to
greeting: (name: string, time: string): string => i18next.t("abc123def4", [name, time])
```

### Excluding Messages from Translation

Use JSDoc comments to exclude specific functions:

```typescript
export const Messages = {
  // This will be translated
  translate: (): string => "Translate me",
  
  /** @noTranslate */
  doNotTranslate: (): string => "Keep as-is",
  
  /**
   * @noTranslate
   * This is a debug message that shouldn't be translated
   */
  debugInfo: (): string => "Debug: Component mounted"
};
```

## 🏗️ How It Works

1. **AST Transformation**: The loader uses TypeScript's compiler API to parse and transform your code
2. **String Extraction**: Finds function expressions that return string literals
3. **Hash Generation**: Creates stable, deterministic hashes from the source strings
4. **Code Transformation**: Replaces string returns with `i18next.t()` calls
5. **Asset Generation**: The plugin collects all extracted strings and emits translation files

## 🔍 Advanced Usage

### Multiple Translation Namespaces

```typescript
// webpack.config.js
new I18nextAutoKeyEmitPlugin({
  jsonOutputPath: 'locales/en.json',
  topLevelKey: 'common' // Wrap under { "common": { ... } }
})
```

### Dynamic File Processing

```typescript
// Process multiple file patterns
{
  loader: 'i18next-auto-keys',
  options: {
    include: [
      /\.messages\.(ts|tsx)$/,
      /\.i18n\.(ts|tsx)$/,
      /\/locales\/.*\.(ts|tsx)$/
    ]
  }
}
```

### Integration with i18next

```typescript
// src/i18n/config.ts
import i18next from 'i18next';
import Backend from 'i18next-http-backend';

i18next
  .use(Backend)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    backend: {
      loadPath: '/locales/{{lng}}.json'
    }
  });
```

## 🛠️ CLI Tools

The package includes CLI tools for translation workflow management:

### Generate POT Files
Extract translation keys from your source code for translators:

```bash
# Generate POT template file
npx i18next-auto-keys generate-pot --include "**/*.messages.ts" --output ./i18n/messages.pot
```

### Convert PO to JSON
Convert translated .po files to i18next JSON format:

```bash
# Convert single file
npx i18next-auto-keys po-to-json --input ./i18n/es.po --output ./public/locales/es.json

# Convert with top-level key (matches emit plugin behavior)
npx i18next-auto-keys po-to-json --input ./i18n/fr.po --output ./public/locales/fr.json --top-level-key common

# Batch convert multiple files
npx i18next-auto-keys po-to-json --input "./i18n/*.po" --output ./public/locales --batch
```

For detailed CLI usage and options, see [CLI Documentation](USAGE_CLI.md).

## 🧪 Development

### Setup
```bash
git clone https://github.com/username/i18next-auto-keys.git
cd i18next-auto-keys
npm install
```

### Scripts
```bash
npm run build    # Build the package
npm test         # Run tests
npm run test:watch # Watch mode testing
```

### Testing
The project includes comprehensive test coverage:
- Unit tests for transformer logic
- Integration tests for webpack loader
- End-to-end tests for plugin functionality

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
