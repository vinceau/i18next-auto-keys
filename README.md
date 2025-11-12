# i18next-auto-keys

[![npm version](https://img.shields.io/npm/v/i18next-auto-keys.svg?style=flat)](https://npmjs.org/package/i18next-auto-keys "View this project on npm")
[![Build Status](https://github.com/vinceau/i18next-auto-keys/workflows/build/badge.svg)](https://github.com/vinceau/i18next-auto-keys/actions?workflow=build)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Automatic translation key generation for i18next** - No more manual key management!

## ✨ Features

- 🔄 **Automatic key generation** - No manual key management required
- 📍 **Colocated translations** - Text strings live next to the components that use them
- 📦 **Framework agnostic** - Works with React, Vue, Angular, or vanilla JS
- 🔒 **Typesafe by default** - Full TypeScript support with AST transformation

## 🎯 Why this over other i18next libraries?

Traditional i18next libraries like **react-i18next** force you to:
- **Manually manage translation keys** - tedious and error-prone
- **Rewrite your entire codebase** to use their APIs (`t('some.key')` everywhere)
- **Buy into their ecosystem** - change how you write and organize code
- **Separate translations from code** - hunt through `.json` files to find text strings

With `i18next-auto-keys`, you:
- **Keep writing normal TypeScript** - no special APIs to learn
- **Stay library-agnostic** - developers don't even know what i18n library powers translations
- **Easy migration** - switch translation systems with minimal changes to application code

`i18next-auto-keys` automatically extracts strings from your code and replaces them with `i18next.t()` calls using auto-generated hash keys at build time.

## 📋 Requirements

- Node.js 16+
- Webpack 5+
- TypeScript 5+ (We use a Typescript transformer)

## 📦 Installation

```bash
npm install --save-dev i18next-auto-keys

# Your project will also need these dependencies if you don't already have them
npm install --save i18next i18next-icu
```

## 🚀 Quick Start

### 1. Write your messages in regular Typescript

You should use the [ICU format](https://formatjs.github.io/docs/intl-messageformat/) for plurals and formatting.

```typescript
// src/components/LoginForm.messages.ts
export const LoginMessages = {
  errorInvalid: (email: string): string => "Invalid email: {email}",

  // ICU pluralization examples
  loginAttempts: (count: number): string =>
    "{count, plural, one {# login attempt} other {# login attempts}} remaining",
};
```

### 2. Import and use the Messages


Convert this:

```tsx
// src/components/LoginForm.tsx
function LoginForm(props) {
  return (
    <div>
      <div>Invalid email: {props.email}</div>
      <div>
      {props.loginAttemptsRemaining} login {props.loginAttemptsRemaining === 1 ? "attempt" : "attempts"} remaining
      </div>
    </div>
  );
}
```

Into this:

```tsx
// src/components/LoginForm.tsx
import { LoginMessages } from "./LoginForm.messages.ts";

function LoginForm(props) {
  return (
    <div>
      <div>{LoginMessages.errorInvalid(props.email)}</div>
      <div>{LoginMessages.loginAttempts(props.loginAttemptsRemaining)}</div>
    </div>
  );
}
```

### 3. Configure webpack

```javascript
// webpack.config.js
const { I18nextAutoKeyEmitPlugin } = require('i18next-auto-keys');

module.exports = {
  module: {
    rules: [
      {
        test: /\.messages\.(ts|tsx)$/, // Only process message files
        exclude: /node_modules/,
        enforce: 'pre', // Ensure this runs before actual TS -> JS compilation
        use: {
          loader: 'i18next-auto-keys',
          options: {
            setDefaultValue: process.env.NODE_ENV === 'development', // For HMR support
          }
        }
      }
    ]
  },
  plugins: [
    new I18nextAutoKeyEmitPlugin({
      jsonOutputPath: 'locales/en.json', // path to your i18next JSON resources
    })
  ]
};
```

### 4. Profit!

The loader automatically transforms your code:

```typescript
// After transformation
import i18next from "i18next";

export const LoginMessages = {
  errorInvalid: (email: string): string => i18next.t("p6q7r8s9t0", { email }),
  loginAttempts: (count: number): string => i18next.t("u8v9w0x1y2", { count }),
};
```

And generates translation files:

```json
// dist/locales/en.json
{
  "p6q7r8s9t0": "Invalid email: {email}",
  "u8v9w0x1y2": "{count, plural, one {# login attempt} other {# login attempts}} remaining",
}
```

## 🎯 Usage Patterns

### Pluralization

Since keys are auto-generated, we can't use i18next's default key-based pluralization (`_zero`, `_one`, etc.). Instead we use the **ICU message format** which handles plurals and inline formatting:

- **Pluralization**: `{count, plural, one {# item} other {# items}}`
- **Number/Date formatting**: `{price, number, currency}` • `{date, date, short}`
- **Conditional text**: `{status, select, online {Connected} offline {Disconnected}}`

[Learn more about ICU format →](https://formatjs.github.io/docs/intl-messageformat/)


### Parameter Handling

> [!WARNING]
> **Do NOT use JavaScript string interpolation (`${}`) in your message functions!**

```typescript
// ❌ WRONG - Creates unstable hashes
greeting: (name: string): string => `Hello ${name}!`

// ✅ CORRECT - Use ICU format
greeting: (name: string): string => "Hello {name}!"
status: (count: number): string => "{count, plural, one {# item} other {# items}}"
```


### Message Files Organization

Create dedicated message files for better organization:

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

### Supports Different Function Syntax

Supports arrow functions, function expressions, and method shorthand:

```typescript
export const Messages = {
  // Arrow functions
  arrowStyle: (name: string): string => "Hello {name}",

  // Function expressions
  functionStyle: function(count: number): string {
    return "{count, plural, one {# item} other {# items}}";
  },

  // Method shorthand
  methodStyle(status: string): string {
    return "Status: {status}";
  },
};
```

### JSDoc Parameter Extraction for Translators

When using the CLI to generate PO files, JSDoc comments are automatically extracted to provide **context for translators**, especially useful with **ICU indexed mode**:

```typescript
/**
 * User account summary message
 * @param userName The user's display name
 * @param accountType Type of account (free, premium, enterprise)
 * @param daysSince Days since account creation
 * @translationContext user-account-summary
 */
userSummary: (userName: string, accountType: string, daysSince: number): string =>
  "User {userName} has {accountType} account (active for {daysSince, number} days)"
```

**Generated PO file with translator context:**
```po
#. User account summary message
#. {0} userName: string - The user's display name
#. {1} accountType: string - Type of account (free, premium, enterprise)
#. {2} daysSince: number - Days since account creation
msgctxt "user-account-summary"
msgid "User {userName} has {accountType} account (active for {daysSince, number} days)"
msgstr ""
```

### Parameter Modes

**Named (Default):** Use parameter names in ICU format
```typescript
greeting: (name: string): string => "Hello {name}!"
// Transforms to: i18next.t("abc123", { name })
```

**Indexed:** Use numbered placeholders
```typescript
greeting: (name: string): string => "Hello {0}!"
// Transforms to: i18next.t("abc123", { "0": name })
```

### Excluding Messages from Translation

Use JSDoc comments to exclude specific functions:

```typescript
/** @noTranslate */
debugInfo: (): string => "Debug: Component mounted"
```

### Translation Context for Message Disambiguation

Use `@translationContext` in JSDoc comments to provide context for identical strings that may need different translations:

```typescript
export const Messages = {
  /** @translationContext gaming */
  playGame: (): string => "Play",

  /** @translationContext music */
  playMusic: (): string => "Play",
};
```

This helps translators distinguish between contexts. For example, in Spanish:
- Gaming context: "Jugar" (to play a game)
- Music context: "Reproducir" (to play music)

**Generated PO file with context:**
```po
#. Play button for games
msgctxt "gaming"
msgid "Play"
msgstr ""

#. Play button for music
msgctxt "music"
msgid "Play"
msgstr ""
```

### setDefaultValue Option

Includes original strings as fallback values. Useful for development mode or HMR:

```typescript
// Source
message: (name: string): string => "Hello {name}"

// Transformed to
message: (name: string): string => i18next.t("abc123def4", { defaultValue: "Hello {name}", name })
```

Use in development to keep production bundles small, or if you don't want to load your default language from a JSON resource.

### Debug Mode

Wrap transformed strings with `~~` markers to easily identify which strings are using the translation system in your running application.

This is particularly useful when gradually migrating an existing codebase to use i18next-auto-keys. The wrapped strings will be visually distinct, making it easy to spot which strings have been migrated vs which are still hardcoded. It also helps developers consider the spacial requirements of other languages, especially more verbose languages which might require more space.

**Configuration:**

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.messages\.(ts|tsx)$/,
        use: {
          loader: 'i18next-auto-keys',
          options: {
            debug: process.env.NODE_ENV === 'development',
          }
        }
      }
    ]
  }
};
```

**Example transformation:**

```typescript
// Source
greeting: (): string => "Hello world"

// Transformed in development with debug: true
greeting: (): string => `~~${i18next.t("abc123def4")}~~`

// Result in browser: "~~Hello world~~"
```

**Safety Note:**
Debug mode is **automatically disabled** when `NODE_ENV=production`, even if you accidentally set `debug: true`. This prevents debug markers from appearing in production builds.


## 🛠️ CLI Tools

**Extract** translation keys from source files:
```bash
npx i18next-auto-keys extract --include "**/*.messages.ts" --output ./i18n/messages.pot
```

**Sync** existing PO files with new strings:
```bash
npx i18next-auto-keys sync --template ./i18n/messages.pot --po-files "./i18n/*.po" --backup
```

**Convert** PO files to JSON:
```bash
npx i18next-auto-keys convert --input "./i18n/*.po" --output ./public/locales --batch
```

**Status** - Show translation progress for PO files:
```bash
npx i18next-auto-keys status
```

[Full CLI documentation →](USAGE_CLI.md)


## ⚙️ Configuration

### Project Configuration File

Optional config file for project-wide settings. Supports multiple formats: `i18next-auto-keys.config.js`, `.i18next-auto-keysrc.json`, or `package.json`.

```javascript
// i18next-auto-keys.config.js
module.exports = {
  poOutputDirectory: "locales",
  poTemplateName: "messages.pot",
  hashLength: 12,
  argMode: "named",
  topLevelKey: "common",
  projectId: "my-app v2.1.0", // Optional: defaults to package.json name + version
  jsonIndentSpaces: 2,
};
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `poOutputDirectory` | `string` | `"i18n"` | Directory where PO template files are output |
| `poTemplateName` | `string` | `"messages.pot"` | Name of the PO template file |
| `hashLength` | `number` | `10` | Length of generated hash keys (minimum 10) |
| `argMode` | `'indexed' \| 'named'` | `'named'` | How to pass parameters to `i18next.t()` |
| `topLevelKey` | `string` | `undefined` | Wrap translations under a top-level key |
| `projectId` | `string` | `package.json name + version` (fallback: `"app 1.0"`) | Project ID for PO file headers |
| `jsonIndentSpaces` | `number` | `2` | JSON indentation spaces for output files |

### Webpack Loader Options

These options override configuration file settings when specified:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `include` | `RegExp \| RegExp[]` | `*` | Pattern(s) to match files for processing |
| `hashLength` | `number` | From config | Length of generated hash keys (minimum 10) |
| `argMode` | `'indexed' \| 'named'` | From config | How to pass parameters to `i18next.t()` |
| `sourcemap` | `boolean` | `false` | Generate source maps |
| `setDefaultValue` | `boolean` | `false` | Include original strings as `defaultValue` in i18next calls |
| `debug` | `boolean` | `false` | Wrap transformed strings with `~~` markers for visual debugging |

### Webpack Plugin Options

These options override configuration file settings when specified:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `jsonOutputPath` | `string` | **Required** | Path for JSON translation file |
| `topLevelKey` | `string` | From config | Wrap translations under a top-level key |


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
