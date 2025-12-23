# Visual Project Structure

## Legend
```
✅ = Shared (bundler-agnostic)
🔵 = Webpack-specific
🟢 = Rollup/Vite-specific
🟡 = Entry point
📦 = Test code
📄 = Configuration
```

## Proposed Structure (Visual Tree)

```
i18next-auto-keys/
│
├── 🟡 src/index.ts                        # Single entry point (exports all)
│
├── ✅ src/cli/                             # CLI tools (shared)
│   ├── cli.ts
│   ├── convert/
│   ├── extract/
│   ├── status/
│   ├── sync/
│   └── utils/
│
├── ✅ src/common/                          # Shared utilities
│   ├── config/
│   │   ├── loadConfig.ts
│   │   └── tests/
│   ├── hash.ts
│   ├── i18nStore.ts
│   ├── stringPool.ts
│   └── tests/
│
├── ✅ src/transformers/                    # AST transformation (shared)
│   ├── i18nextAutoKeyTransformer.ts
│   └── tests/
│       └── i18nextAutoKeyTransformer.test.ts
│
├── 🔵 src/webpack/                         # Webpack namespace
│   ├── loader.ts                          # Webpack loader
│   ├── plugin.ts                          # Webpack plugin
│   ├── emitIfChanged.ts                   # Webpack helper
│   └── 📦 tests/
│       ├── loader.integration.test.ts
│       ├── loader.pipeline.test.ts
│       ├── plugin.test.ts
│       └── plugin.integration.test.ts
│
└── 🟢 src/rollup/                          # Rollup/Vite namespace
    ├── plugin.ts                          # Rollup plugin (works with Vite)
    └── 📦 tests/
        └── plugin.test.ts


e2e/                                       # End-to-end tests
│
├── ✅ shared/                              # Shared test fixtures
│   └── src/
│       ├── auth.messages.ts
│       ├── auth-indexed.messages.ts
│       ├── ui.messages.ts
│       ├── ui-indexed.messages.ts
│       ├── replay-browser.messages.ts
│       ├── replay-browser-indexed.messages.ts
│       └── context.messages.ts
│
├── 🔵 webpack/                             # Webpack E2E tests
│   ├── src/
│   │   ├── index.ts                       # Test entry point
│   │   └── icu-index.ts                   # ICU test entry
│   ├── 📦 tests/
│   │   ├── e2e.test.ts
│   │   ├── icu.e2e.test.ts
│   │   ├── cli.e2e.test.ts
│   │   └── config.simple.e2e.test.ts
│   ├── 📄 webpack-configs.ts
│   ├── 📄 package.json
│   ├── 📄 tsconfig.json
│   └── 📄 jest.config.js
│
├── 🟢 rollup/                              # Rollup E2E tests
│   ├── src/
│   │   └── index.ts                       # Test entry point
│   ├── 📦 tests/
│   │   └── rollup.e2e.test.ts
│   ├── 📄 rollup.config.js
│   ├── 📄 package.json
│   ├── 📄 tsconfig.json
│   └── 📄 jest.config.js
│
└── 🟢 vite/                                # Vite E2E tests
    ├── src/
    │   └── index.ts                       # Test entry point
    ├── 📦 tests/
    │   └── vite.e2e.test.ts
    ├── 📄 vite.config.js
    ├── 📄 package.json
    ├── 📄 tsconfig.json
    └── 📄 jest.config.js


examples/                                  # Usage examples
├── 🔵 webpack-example/
│   └── webpack.config.js
├── 🟢 rollup-example/
│   └── rollup.config.js
└── 🟢 vite-example/
    └── vite.config.js


dist/                                      # Build output
├── 🟡 index.js                             # Single bundle (all exports)
├── 🟡 index.d.ts                           # Type declarations
└── cli.js                                 # CLI binary
```

## Import Flow Diagram

```
User Code                    Package Entry             Source Code
═══════════                  ═════════════             ═══════════

Webpack:
require('i18next-auto-keys') ──→ dist/index.js ──→ src/index.ts ──→ src/webpack/
       │                                                   ↓
       └─ .I18nextAutoKeyEmitPlugin                   exports from
       └─ (loader)                                    webpack namespace


Rollup/Vite:
import from 'i18next-auto-keys' ──→ dist/index.js ──→ src/index.ts ──→ src/rollup/
       │                                                  ↓
       └─ .i18nextAutoKeyRollupPlugin                exports from
                                                      rollup namespace

Both use the same entry point!
```

## Code Dependencies (Data Flow)

```
                              ┌──────────────────┐
                              │   User's Code    │
                              │  (webpack/vite)  │
                              └────────┬─────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                      │
         ┌──────────▼─────────┐              ┌───────────▼──────────┐
         │  Webpack Loader    │              │   Rollup Plugin      │
         │  (src/webpack/)    │              │   (src/rollup/)      │
         └──────────┬─────────┘              └───────────┬──────────┘
                    │                                     │
                    └──────────────────┬──────────────────┘
                                       │
                              ┌────────▼─────────┐
                              │   Transformers   │◄─── Core AST logic
                              │ (src/transformers)│
                              └────────┬─────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
         ┌──────────▼─────────┐ ┌─────▼──────┐ ┌────────▼────────┐
         │   i18nStore        │ │   Hash     │ │    Config       │
         │ (src/common/)      │ │ (src/common)│ │  (src/common/)  │
         └────────────────────┘ └────────────┘ └─────────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │ Translation JSON │
                              │   (output)       │
                              └─────────────────┘
```

## Test Organization

```
Unit Tests                          E2E Tests
══════════                          ═════════

src/webpack/tests/                  e2e/webpack/
├── loader.test.ts                  ├── tests/e2e.test.ts
├── plugin.test.ts         ◄────────┤ tests/icu.e2e.test.ts
└── ...                             └── ...
                                         │
                                         │ uses fixtures from
                                         ▼
src/rollup/tests/                   e2e/shared/src/
├── plugin.test.ts         ◄────────┤── auth.messages.ts
                                    ├── ui.messages.ts
                                    └── ...
                                         ▲
                                         │ also used by
                                         │
src/transformers/tests/             e2e/rollup/
└── transformer.test.ts    ◄────────├── tests/rollup.e2e.test.ts
                                    └── ...

src/common/tests/                   e2e/vite/
├── hash.test.ts           ◄────────├── tests/vite.e2e.test.ts
├── i18nStore.test.ts               └── ...
└── ...
```

## Build Process

```
Source Files                Build Step              Output Files
════════════                ══════════              ════════════

src/index.ts       ──────┐
src/cli/cli.ts     ──────┤
                         │
src/webpack/       ──────┤
src/rollup/        ──────┤
src/transformers/  ──────┤  webpack build   ──→  dist/index.js
src/common/        ──────┤  (single bundle)       dist/cli.js
                         │
                         │
                         └──→ dts-generator ──→  dist/index.d.ts
                              (types)              dist/cli.d.ts

Simple single-entry build!
```

## Package Configuration

```
package.json
════════════

{
  "main": "dist/index.js",      ← Single entry point
  "types": "dist/index.d.ts",   ← Single type declaration
  "files": [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/cli.js"
  ]
}

No exports field needed!
Simple configuration.
```

## Scaling Pattern (Adding New Bundler)

```
Want to add esbuild support?

1. Create src/esbuild/
   └── plugin.ts
   └── tests/

2. Update src/index.ts:
   import { i18nextAutoKeyEsbuildPlugin } from "./esbuild/plugin";
   export { i18nextAutoKeyEsbuildPlugin };

3. Create e2e/esbuild/
   ├── src/
   ├── tests/
   └── package.json

4. Update examples/
   └── esbuild-example/

Done! Clear pattern to follow.
No build config changes needed.
```

## File Count Summary

### Current Structure
```
src/
├── cli/         : 10 files (shared)
├── common/      :  8 files (shared)
├── transformers :  2 files (shared)
├── loaders/     :  4 files (webpack, not obvious)
└── plugins/     :  5 files (MIXED webpack + rollup) ⚠️
Total: 29 files
```

### Proposed Structure
```
src/
├── cli/         : 10 files (shared)      ✅ no change
├── common/      :  8 files (shared)      ✅ no change
├── transformers :  2 files (shared)      ✅ no change
├── webpack/     :  7 files (clear)       🔵 webpack-specific
└── rollup/      :  2 files (clear)       🟢 rollup-specific
Total: 29 files (same count, better organization)
```

## Complexity Comparison

### Current Approach
```
Source Complexity:    Medium  (mixed concerns)
Build Complexity:     Low     (single entry)
User Complexity:      Low     (simple imports)
Maintenance:          Medium  (unclear boundaries)
```

### Proposed Approach
```
Source Complexity:    Low     (clear namespaces)
Build Complexity:     Low     (single entry)
User Complexity:      Low     (simple imports)
Maintenance:          Low     (clear boundaries)
```

### Alternative (Multiple Entry Points)
```
Source Complexity:    Low     (clear namespaces)
Build Complexity:     Medium  (multiple entries)
User Complexity:      Medium  (multiple import paths)
Maintenance:          Medium  (more config to maintain)
```

**Winner: Proposed Approach** - Best balance of simplicity and organization.

## Summary

The proposed structure:
- ✅ Clearly separates concerns with namespaces
- ✅ Maintains simple single entry point
- ✅ No build complexity increase
- ✅ Zero breaking changes
- ✅ Clear pattern for new bundlers
- ✅ Better code organization
- ✅ Easier for new contributors

**Key Insight:** Namespace organization provides all the benefits without needing multiple entry points!
