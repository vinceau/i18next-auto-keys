# Using i18next-auto-keys with Vite and Rollup

This guide explains how to use `i18next-auto-keys` with Vite and Rollup bundlers.

## Overview

The `i18nextAutoKeyRollupPlugin` is a unified plugin that works with both **Rollup** and **Vite** (since Vite uses Rollup under the hood for production builds). This single plugin replaces the separate Webpack loader and plugin architecture with a simpler, unified approach.

## Installation

```bash
npm install --save-dev i18next-auto-keys

# Your project will also need these dependencies if you don't already have them
npm install --save i18next i18next-icu

# For Vite
npm install --save-dev vite

# For Rollup
npm install --save-dev rollup
```

## Usage with Vite

### Basic Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys';

export default defineConfig({
  plugins: [
    i18nextAutoKeyRollupPlugin({
      // Path where the JSON translation file will be emitted
      jsonOutputPath: 'locales/en.json',
      
      // Optional: Use original strings as fallback in development
      setDefaultValue: process.env.NODE_ENV === 'development',
    }),
  ],
});
```

### With React

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys';

export default defineConfig({
  plugins: [
    react(),
    i18nextAutoKeyRollupPlugin({
      jsonOutputPath: 'locales/en.json',
      include: [/\.messages\.(ts|tsx)$/], // Only process message files
    }),
  ],
});
```

### With Vue

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys';

export default defineConfig({
  plugins: [
    vue(),
    i18nextAutoKeyRollupPlugin({
      jsonOutputPath: 'locales/en.json',
      include: [/\.messages\.ts$/],
    }),
  ],
});
```

## Usage with Rollup

### Basic Configuration

```javascript
// rollup.config.js
import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
  },
  plugins: [
    typescript(),
    i18nextAutoKeyRollupPlugin({
      jsonOutputPath: 'locales/en.json',
    }),
  ],
};
```

### Advanced Configuration

```javascript
// rollup.config.js
import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript(),
    i18nextAutoKeyRollupPlugin({
      // Only process files matching these patterns
      include: [/\.messages\.(ts|tsx)$/],
      
      // Path for JSON output
      jsonOutputPath: 'locales/en.json',
      
      // Use ICU indexed mode (numbered placeholders like {0}, {1})
      argMode: 'indexed',
      
      // Include original strings as defaultValue in dev mode
      setDefaultValue: process.env.NODE_ENV === 'development',
      
      // Wrap transformed strings with ~~ markers for visual debugging
      debug: process.env.NODE_ENV === 'development',
      
      // Nest translations under a top-level key
      topLevelKey: 'common',
    }),
  ],
};
```

## Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `jsonOutputPath` | `string` | **Required** | Path where the JSON translation file will be emitted (e.g., `"locales/en.json"`) |
| `include` | `RegExp \| RegExp[]` | `/\.messages\.(ts\|tsx)$/` | Pattern(s) to match files for processing |
| `argMode` | `'indexed' \| 'named'` | `'named'` | How to pass parameters to `i18next.t()` calls |
| `setDefaultValue` | `boolean` | `false` | Include original strings as `defaultValue` in i18next calls |
| `debug` | `boolean` | `false` | Wrap transformed strings with `~~` markers for visual debugging |
| `topLevelKey` | `string` | `undefined` | Wrap translations under a top-level key in the JSON output |

## How It Works

### Development vs Production

**Vite Development Mode:**
- The plugin's `transform` hook processes your message files on-the-fly
- Hot Module Replacement (HMR) works seamlessly
- Changes to message files are reflected immediately

**Vite Production Build:**
- Vite uses Rollup internally
- The plugin transforms files and emits the JSON asset
- All hooks (`buildStart`, `transform`, `generateBundle`) are executed

**Rollup:**
- All hooks are executed during the build
- The plugin transforms TypeScript files and emits the JSON output

### Plugin Lifecycle

1. **`buildStart`**: Clears the internal translation store and watches the config file for changes
2. **`transform`**: Processes matching TypeScript files and applies the AST transformation
3. **`generateBundle`**: Collects all translations and emits the JSON file

## Comparison with Webpack

### Webpack (Old Approach)
```javascript
module.exports = {
  module: {
    rules: [{
      test: /\.messages\.(ts|tsx)$/,
      use: 'i18next-auto-keys',
    }]
  },
  plugins: [
    new I18nextAutoKeyEmitPlugin({
      jsonOutputPath: 'locales/en.json',
    })
  ]
};
```

### Vite/Rollup (New Approach)
```javascript
export default {
  plugins: [
    i18nextAutoKeyRollupPlugin({
      jsonOutputPath: 'locales/en.json',
    })
  ]
};
```

The Vite/Rollup approach is simpler because:
- Single plugin instead of loader + plugin
- Uses standard Rollup plugin hooks
- Works with both Vite and Rollup without changes

## Examples

### Message Files

Your message files remain the same regardless of bundler:

```typescript
// src/components/auth.messages.ts
export const AuthMessages = {
  /** @translationContext login-form */
  welcome: (name: string): string => "Welcome back, {name}!",
  
  loginAttempts: (count: number): string =>
    "{count, plural, one {# attempt} other {# attempts}} remaining",
};
```

### Usage in Components

```typescript
// src/components/LoginForm.tsx
import { AuthMessages } from './auth.messages';

export function LoginForm({ user, attemptsLeft }) {
  return (
    <div>
      <h1>{AuthMessages.welcome(user.name)}</h1>
      <p>{AuthMessages.loginAttempts(attemptsLeft)}</p>
    </div>
  );
}
```

### Generated Output

```json
// dist/locales/en.json
{
  "a1b2c3d4e5": "Welcome back, {name}!",
  "f6g7h8i9j0": "{count, plural, one {# attempt} other {# attempts}} remaining"
}
```

## Configuration File

The plugin respects the project configuration file (same as Webpack loader):

```javascript
// i18next-auto-keys.config.js
module.exports = {
  hashLength: 12,
  argMode: 'named',
  topLevelKey: 'common',
  jsonIndentSpaces: 2,
};
```

Plugin options override config file settings.

## TypeScript Support

The plugin includes full TypeScript definitions:

```typescript
import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys';
import type { I18nextAutoKeyRollupPluginOptions } from 'i18next-auto-keys';

const options: I18nextAutoKeyRollupPluginOptions = {
  jsonOutputPath: 'locales/en.json',
  argMode: 'named',
};
```

## Troubleshooting

### Plugin not transforming files

Make sure your `include` pattern matches your message files:

```javascript
i18nextAutoKeyRollupPlugin({
  jsonOutputPath: 'locales/en.json',
  include: [/\.messages\.(ts|tsx)$/], // Adjust pattern to match your files
})
```

### JSON file not being emitted

The JSON file is emitted during the `generateBundle` phase:
- In **Vite dev mode**, the file might not be emitted (only transforms happen)
- In **Vite build** or **Rollup**, the file is always emitted

### Config file changes not triggering rebuild

The plugin automatically watches the config file. If changes aren't detected:
1. Check that the config file exists in one of the expected locations
2. Restart the dev server
3. Verify the config file path in your project root

## Migration from Webpack

If you're migrating from Webpack to Vite/Rollup:

1. **Remove Webpack loader and plugin:**
```javascript
// webpack.config.js - REMOVE THIS
module.exports = {
  module: {
    rules: [{
      test: /\.messages\.(ts|tsx)$/,
      use: 'i18next-auto-keys',
    }]
  },
  plugins: [
    new I18nextAutoKeyEmitPlugin({ ... })
  ]
};
```

2. **Add Vite/Rollup plugin:**
```javascript
// vite.config.js - ADD THIS
import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys';

export default {
  plugins: [
    i18nextAutoKeyRollupPlugin({
      jsonOutputPath: 'locales/en.json',
      // Transfer other options from webpack config
    })
  ]
};
```

3. **Your message files and application code remain unchanged!**

## Additional Resources

- [Main README](README.md) - General usage and concepts
- [CLI Documentation](USAGE_CLI.md) - Command-line tools
- [i18next Documentation](https://www.i18next.com/)
- [ICU Message Format](https://formatjs.github.io/docs/intl-messageformat/)
- [Vite Plugin API](https://vitejs.dev/guide/api-plugin.html)
- [Rollup Plugin API](https://rollupjs.org/plugin-development/)

