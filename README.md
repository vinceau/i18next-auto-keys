# i18next-auto-keys

[![npm version](https://img.shields.io/npm/v/i18next-auto-keys.svg?style=flat)](https://npmjs.org/package/i18next-auto-keys "View this project on npm")
[![Build Status](https://github.com/vinceau/i18next-auto-keys/workflows/build/badge.svg)](https://github.com/vinceau/i18next-auto-keys/actions?workflow=build)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Automatic translation key generation for i18next with ICU format** - No more manual key management!

`i18next-auto-keys` is a webpack loader and plugin that automatically extracts string literals from your code and replaces them with `i18next.t()` calls using auto-generated hash keys. Since developers don't need to know the generated keys, this package works best with **ICU message format** and **i18next-icu** plugin for pluralization and advanced formatting, rather than the default i18next key-based pluralization system.

## ✨ Features

- 🔄 **Automatic key generation** - Hash-based keys generated from source strings
- 🌐 **ICU format support** - Works seamlessly with i18next-icu for pluralization and formatting
- 📦 **Webpack integration** - Seamless webpack loader and plugin
- 🔧 **TypeScript support** - Full TypeScript AST transformation
- 🛠️ **CLI tools** - Extract keys from files, generate POT template files, and convert PO to JSON

## 💡 Why ICU Format?

Since this library generates translation keys automatically, developers don't know the keys beforehand. This makes the default i18next pluralization method (which relies on key suffixes like `_zero`, `_one`, `_other`) impractical. Instead, **ICU message format** with **i18next-icu** provides:

- **Inline pluralization**: `{count, plural, one {# item} other {# items}}`
- **Number formatting**: `{price, number, currency}`
- **Date formatting**: `{date, date, short}`
- **Conditional text**: `{status, select, online {Connected} offline {Disconnected}}`

For more information, read the [i18next-icu docs](https://www.npmjs.com/package/i18next-icu) and the [ICU formatting docs](https://formatjs.github.io/docs/intl-messageformat/).

## 📋 Requirements

- Node.js 16+
- Webpack 5+
- TypeScript 4+ (for TypeScript projects)

## 📦 Installation

```bash
npm install --save-dev i18next-auto-keys
npm install --save i18next i18next-icu
```

Optional (for CLI POT/PO conversion):
```bash
npm install --save-dev gettext-parser
```

## 🚀 Quick Start

### 1. Write your code with ICU format

```typescript
// src/components/LoginForm.messages.ts
export const LoginMessages = {
  forgotPassword: (): string => "Forgot Password?",
  errorInvalid: (email: string): string => "Invalid email: {email}",

  // ICU pluralization examples
  loginAttempts: (count: number): string =>
    "{count, plural, one {# login attempt} other {# login attempts}} remaining",

  // ICU number and date formatting
  lastLogin: (date: string): string => "Last login: {date, date, medium}",
  accountAge: (days: number): string => "Account active for {days, number} days",
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
        test: /\.messages\.(ts|tsx)$/, // Only process message files
        exclude: /node_modules/,
        use: [
          {
            loader: 'i18next-auto-keys',
            options: {
              setDefaultValue: process.env.NODE_ENV === 'development', // For HMR support
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new I18nextAutoKeyEmitPlugin({
      jsonOutputPath: 'locales/en.json',
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
  forgotPassword: (): string => i18next.t("k1l2m3n4o5"),
  errorInvalid: (email: string): string => i18next.t("p6q7r8s9t0", { email }),
  loginAttempts: (count: number): string => i18next.t("u8v9w0x1y2", { count }),
  lastLogin: (date: string): string => i18next.t("z3a4b5c6d7", { date }),
  accountAge: (days: number): string => i18next.t("e8f9g0h1i2", { days }),
};
```

And generates translation files:

```json
// dist/locales/en.json
{
  "k1l2m3n4o5": "Forgot Password?",
  "p6q7r8s9t0": "Invalid email: {email}",
  "u8v9w0x1y2": "{count, plural, one {# login attempt} other {# login attempts}} remaining",
  "z3a4b5c6d7": "Last login: {date, date, medium}",
  "e8f9g0h1i2": "Account active for {days, number} days"
}
```

## ⚙️ Configuration

### Loader Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `include` | `RegExp \| RegExp[]` | `*` | Pattern(s) to match files for processing |
| `hashLength` | `number` | `10` | Length of generated hash keys (minimum 10) |
| `argMode` | `'indexed' \| 'named'` | `'named'` | How to pass parameters to `i18next.t()` |
| `sourcemap` | `boolean` | `false` | Generate source maps |
| `setDefaultValue` | `boolean` | `false` | Include original strings as `defaultValue` in i18next calls |

### Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `jsonOutputPath` | `string` | **Required** | Path for JSON translation file |
| `topLevelKey` | `string` | `undefined` | Wrap translations under a top-level key |

## 🎯 Usage Patterns

### Message Files Organization

Create dedicated message files with ICU format for better organization:

```typescript
// src/pages/auth/auth.messages.ts
export const AuthMessages = {
  // Simple messages
  title: (): string => "Authentication",
  subtitle: (): string => "Please sign in to continue",

  // Messages with ICU interpolation
  welcome: (name: string): string => "Welcome back, {name}!",

  // ICU pluralization
  attemptsLeft: (count: number): string =>
    "{count, plural, one {# attempt} other {# attempts}} remaining",
};
```

### Function Expression Syntax Support

`i18next-auto-keys` supports **three different function syntax styles**:

```typescript
export const Messages = {
  // 1. Arrow functions (most common)
  /**
   * Shows user greeting
   * @param name The user's display name
   * @param role The user's role in the system
   */
  arrowStyle: (name: string, role: string): string => "Hello {name}, you are a {role}",

  // 2. Function expressions
  /**
   * Displays item count
   * @param count Number of items
   * @param category Item category
   */
  functionStyle: function(count: number, category: string): string {
    return "Found {count} {category} items";
  },

  // 3. Method shorthand (ES6+)
  /**
   * Shows status message
   * @param status Current connection status
   * @param timestamp When status was last updated
   */
  methodStyle(status: string, timestamp: Date): string {
    return "Status: {status} (updated {timestamp, date, short})";
  },
};
```

### JSDoc Parameter Extraction for Translators

When using the CLI to generate POT files, JSDoc comments are automatically extracted to provide **context for translators**, especially useful with **ICU indexed mode**:

```typescript
/**
 * User account summary message
 * @param userName The user's display name
 * @param accountType Type of account (free, premium, enterprise)
 * @param daysSince Days since account creation
 */
userSummary: (userName: string, accountType: string, daysSince: number): string =>
  "User {userName} has {accountType} account (active for {daysSince, number} days)"
```

**Generated POT file with translator context:**
```po
#. User account summary message
#. {0} userName: string - The user's display name
#. {1} accountType: string - Type of account (free, premium, enterprise)  
#. {2} daysSince: number - Days since account creation
msgctxt "a1b2c3d4e5"
msgid "User {userName} has {accountType} account (active for {daysSince, number} days)"
msgstr ""
```

### ICU Format Parameter Handling

> [!WARNING]
> **Do NOT use JavaScript string interpolation (`${}`) in your message functions!**

```typescript
// ❌ WRONG - Don't do this
export const Messages = {
  greeting: (name: string): string => `Hello ${name}!`,           // String changes = unstable hash
  status: (count: number): string => `You have ${count} items`,   // Can't use ICU pluralization
};

// ✅ CORRECT - Use ICU format instead
export const Messages = {
  greeting: (name: string): string => "Hello {name}!",          // Stable string + ICU format
  status: (count: number): string => "You have {count, plural, one {# item} other {# items}}",  // ICU pluralization
};
```

### Parameter Modes

#### Named Mode (Default)
```typescript
// Source with ICU format
greeting: (name: string, time: string): string => "Hello {name}, good {time}!"
pluralItems: (count: number): string => "{count, plural, one {# item} other {# items}}"

// Transformed to
greeting: (name: string, time: string): string => i18next.t("abc123def4", { name, time })
pluralItems: (count: number): string => i18next.t("xyz789abc1", { count })

// JSON output (ICU format preserved)
{
  "abc123def4": "Hello {name}, good {time}!",
  "xyz789abc1": "{count, plural, one {# item} other {# items}}"
}
```

#### Indexed Mode (Shorter - more concise)

This mode makes it easier to differentiate between parameters and translation text. The indexed order is the same as the order of the function parameters.

```typescript
// webpack.config.js
{
  loader: 'i18next-auto-keys',
  options: {
    argMode: 'indexed'
  }
}

// Source with ICU format using indexed parameters
greeting: (name: string, time: string): string => "Hello {0}, good {1}!"
pluralItems: (count: number): string => "{0, plural, one {# item} other {# items}}"

// Transformed to
greeting: (name: string, time: string): string => i18next.t("abc123def4", { "0": name, "1": time })
pluralItems: (count: number): string => i18next.t("xyz789abc1", { "0": count })
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

### setDefaultValue Option

The `setDefaultValue` option includes the original English strings as fallback values in your i18next calls. When enabled, it transforms:

```typescript
// Source
message: (name: string): string => "Hello {name}"

// Transformed to
message: (name: string): string => i18next.t("abc123def4", { defaultValue: "Hello {name}", name })
```

Typically you should only enable this in development mode to support HMR, or if you don't want to use the emit plugin's generated JSON for your default language.

In production, you should typically use the JSON files generated by the emit plugin rather than embedding default values directly in your code. This keeps your bundle size smaller and allows for easier updates to default translations without redeploying your application.


## 🏗️ How It Works

1. **AST Transformation**: The loader uses TypeScript's compiler API to parse and transform your code
2. **String Extraction**: Finds function expressions that return string literals
3. **Hash Generation**: Creates stable, deterministic hashes from the source strings
4. **Code Transformation**: Replaces string returns with `i18next.t()` calls
5. **Asset Generation**: The plugin collects all extracted strings and emits translation files


## 🛠️ CLI Tools

The package includes CLI tools for translation workflow management:

### Extract Messages and Generate POT File
Extract translation keys from your source code for translators:

```bash
# Extract messages keys and generate POT template file
npx i18next-auto-keys extract --include "**/*.messages.ts" --output ./i18n/messages.pot
```

### Update PO Files
Update existing .po files with new strings from POT template:

```bash
# Update all .po files with new strings
npx i18next-auto-keys update --template ./i18n/messages.pot --po-files "./i18n/*.po" --backup
```

### Convert PO to JSON
Convert translated .po files to i18next JSON format:

```bash
# Convert single file
npx i18next-auto-keys convert --input ./i18n/es.po --output ./public/locales/es.json

# Convert with top-level key (matches emit plugin behavior)
npx i18next-auto-keys convert --input ./i18n/fr.po --output ./public/locales/fr.json --top-level-key common

# Batch convert multiple files
npx i18next-auto-keys convert --input "./i18n/*.po" --output ./public/locales --batch
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

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
