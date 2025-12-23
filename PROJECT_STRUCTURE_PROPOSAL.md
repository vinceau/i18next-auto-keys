# Project Structure Proposal: Webpack vs Rollup Separation

## Executive Summary

This document proposes a clean separation of webpack and rollup/vite concerns in the `i18next-auto-keys` project. The recent addition of rollup support (commits `0f25f37` and `4c0d408`) introduced bundler-specific code alongside the existing webpack-only structure. This proposal aims to:

1. **Separate bundler-specific code** into clear namespaces (`src/webpack/`, `src/rollup/`)
2. **Improve maintainability** by clearly delineating concerns
3. **Scale better** as new bundlers may be added in the future
4. **Simplify testing** with isolated test suites per bundler
5. **Keep it simple** with a single entry point - no added build complexity

---

## Current Structure Analysis

### What's Shared (Core Logic)
- **Transformers** (`src/transformers/`) - TypeScript AST transformation (bundler-agnostic)
- **Common utilities** (`src/common/`) - Config, hashing, i18n store, string pool
- **CLI** (`src/cli/`) - Command-line tools (bundler-agnostic)

### What's Bundler-Specific

#### Webpack-specific
- `src/loaders/i18nextAutoKeyLoader.ts` - Webpack loader
- `src/plugins/i18nextAutoKeyEmitPlugin.ts` - Webpack plugin
- `src/plugins/emitIfChanged.ts` - Webpack-specific helper

#### Rollup/Vite-specific
- `src/plugins/i18nextAutoKeyRollupPlugin.ts` - Rollup plugin (also works with Vite)

### Current Issues

1. **Mixed concerns in `/plugins`**: Both webpack and rollup plugins live together
2. **No clear bundler boundaries**: Entry point exports everything together
3. **E2E tests only cover webpack**: No rollup/vite E2E tests yet
4. **Future scalability**: Adding new bundlers (esbuild, rspack, etc.) will clutter further

---

## Proposed Structure

### Bundler-Specific Subdirectories (Single Entry Point)

```
src/
├── index.ts                          # Single entry point (exports all)
├── cli/                              # CLI tools (shared)
│   └── ...
├── common/                           # Shared utilities
│   ├── config/
│   ├── hash.ts
│   ├── i18nStore.ts
│   └── stringPool.ts
├── transformers/                     # Shared AST transformation
│   ├── i18nextAutoKeyTransformer.ts
│   └── tests/
├── webpack/                          # Webpack-specific code
│   ├── loader.ts                     # (renamed from i18nextAutoKeyLoader.ts)
│   ├── plugin.ts                     # (renamed from i18nextAutoKeyEmitPlugin.ts)
│   ├── emitIfChanged.ts
│   └── tests/
│       ├── loader.integration.test.ts
│       ├── loader.pipeline.test.ts
│       └── plugin.test.ts
└── rollup/                           # Rollup/Vite-specific code
    ├── plugin.ts                     # (renamed from i18nextAutoKeyRollupPlugin.ts)
    └── tests/
        └── plugin.test.ts

e2e/
├── shared/                           # Shared test fixtures
│   └── src/
│       ├── auth.messages.ts
│       ├── ui.messages.ts
│       └── ...
├── webpack/                          # Webpack E2E tests
│   ├── src/                          # Test source files
│   ├── tests/
│   │   ├── e2e.test.ts
│   │   ├── icu.e2e.test.ts
│   │   └── ...
│   ├── webpack-configs.ts
│   └── package.json
├── rollup/                           # Rollup E2E tests (NEW)
│   ├── src/                          # Test source files
│   ├── tests/
│   │   └── rollup.e2e.test.ts
│   ├── rollup.config.js
│   └── package.json
└── vite/                             # Vite E2E tests (NEW)
    ├── src/                          # Test source files
    ├── tests/
    │   └── vite.e2e.test.ts
    ├── vite.config.js
    └── package.json
```

### Entry Point Strategy

**Single entry point (`dist/index.js` / `src/index.ts`)**
- Maintains backward compatibility
- Exports all bundler-specific code
- Exports all shared utilities
- Simple to maintain

```typescript
// src/index.ts
import { i18nextAutoKeyLoader } from "./webpack/loader";
import { I18nextAutoKeyEmitPlugin } from "./webpack/plugin";
import { i18nextAutoKeyRollupPlugin } from "./rollup/plugin";
import { createI18nextAutoKeyTransformerFactory } from "./transformers/i18nextAutoKeyTransformer";
import { i18nStore } from "./common/i18nStore";
import { loadConfig } from "./common/config/loadConfig";
import { stableHash } from "./common/hash";

// Webpack loader compatibility (default export)
module.exports = i18nextAutoKeyLoader;
module.exports.I18nextAutoKeyEmitPlugin = I18nextAutoKeyEmitPlugin;
module.exports.i18nextAutoKeyLoader = i18nextAutoKeyLoader;
module.exports.i18nextAutoKeyRollupPlugin = i18nextAutoKeyRollupPlugin;

// Shared functionality for CLI and advanced users
module.exports.createI18nextAutoKeyTransformerFactory = createI18nextAutoKeyTransformerFactory;
module.exports.i18nStore = i18nStore;
module.exports.loadConfig = loadConfig;
module.exports.stableHash = stableHash;

// TypeScript-friendly named exports
export {
  i18nextAutoKeyLoader,
  I18nextAutoKeyEmitPlugin,
  i18nextAutoKeyRollupPlugin,
  createI18nextAutoKeyTransformerFactory,
  i18nStore,
  loadConfig,
  stableHash,
};
```

### Package.json (No Changes Needed)

```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/cli.js"
  ]
}
```

### Import Examples

**Webpack users:**
```javascript
// Still works exactly as before - backward compatible
const { I18nextAutoKeyEmitPlugin } = require('i18next-auto-keys');

module.exports = {
  module: {
    rules: [{
      loader: 'i18next-auto-keys'
    }]
  }
};
```

**Rollup/Vite users:**
```javascript
// Still works exactly as before
import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys';

export default {
  plugins: [
    i18nextAutoKeyRollupPlugin({ jsonOutputPath: 'locales/en.json' })
  ]
};
```

---

## Why Not Separate Entry Points?

We considered creating separate entry points (`src/webpack.ts`, `src/rollup.ts`) with package.json exports, but decided against it because:

**Cons outweigh pros:**
- ❌ Adds build complexity (multiple bundles, multiple type declarations)
- ❌ More files to maintain
- ❌ Minimal tree-shaking benefit (bundlers already handle this well)
- ❌ Webpack and Rollup are already optional peer dependencies
- ❌ Doesn't significantly improve the core goal: maintainable source code

**What matters most:**
- ✅ Clear namespace organization in source code (`src/webpack/`, `src/rollup/`)
- ✅ Isolated test suites
- ✅ Simple build process
- ✅ Easy to understand and maintain

The namespace organization provides all the maintainability benefits without the extra complexity.

---

## Migration Plan

### Phase 1: Restructure Source Code (1-2 hours)

1. Create `src/webpack/` and `src/rollup/` directories
2. Move existing files:
   - `src/loaders/i18nextAutoKeyLoader.ts` → `src/webpack/loader.ts`
   - `src/plugins/i18nextAutoKeyEmitPlugin.ts` → `src/webpack/plugin.ts`
   - `src/plugins/emitIfChanged.ts` → `src/webpack/emitIfChanged.ts`
   - `src/plugins/i18nextAutoKeyRollupPlugin.ts` → `src/rollup/plugin.ts`
3. Move test files accordingly
4. Update `src/index.ts` imports (single entry point)
5. Update all internal imports

### Phase 2: Update Build Configuration (10 min)

1. Verify `webpack.build.config.js` still works (no changes needed)
2. Verify TypeScript declaration generation works

### Phase 3: Restructure E2E Tests (2-3 hours)

1. Create `e2e/shared/src/` with shared test fixtures
2. Move current webpack tests to `e2e/webpack/`
3. Create `e2e/rollup/` with rollup-specific E2E tests
4. Create `e2e/vite/` with vite-specific E2E tests
5. Update E2E npm scripts

### Phase 4: Update Documentation (30 min)

1. Update README.md with new structure
2. Update USAGE_VITE_ROLLUP.md
3. Update examples if needed

### Phase 5: Testing & Validation (1 hour)

1. Run all unit tests
2. Run all E2E tests
3. Test backward compatibility with existing projects
4. Verify TypeScript types are correct

**Total Estimated Time: 4-7 hours**

---

## Benefits

### 1. **Clear Separation of Concerns**
- Bundler-specific code is isolated in clear namespaces
- Easy to understand what code affects which bundler
- New contributors can focus on specific bundlers

### 2. **Better Maintainability**
- Changes to webpack don't affect rollup and vice versa
- Easier to debug bundler-specific issues
- Test isolation prevents cross-contamination
- Simpler build process (single entry point)

### 3. **Scalability**
- Easy to add new bundlers (esbuild, rspack, etc.) following the pattern
- Clear template for what needs to be implemented per bundler
- Just add `src/<bundler>/` directory and update `index.ts`

### 4. **Better Code Navigation**
- IDE navigation is clearer with namespaced folders
- File search is more intuitive
- Ownership is obvious

### 5. **Isolated Testing**
- Unit tests organized by bundler
- E2E tests separated by bundler
- Shared fixtures prevent duplication

### 6. **Backward Compatibility**
- Zero breaking changes
- Main entry point unchanged
- All existing imports continue to work
- No user migration needed

---

## Risks & Mitigation

### Risk 1: Breaking Changes
**Mitigation:** Maintain full backward compatibility in main entry point. Existing imports continue to work. Document migration path but don't force it.

### Risk 2: Test Suite Complexity
**Mitigation:** E2E tests are already isolated per bundler in practice. Just formalizing the structure. Can share test fixtures via `e2e/shared/`.


---

## Recommendation

**Proceed with namespace organization (single entry point)** because:

1. **Right-sized solution**: Clear boundaries without unnecessary complexity
2. **Simpler than alternatives**: No separate packages, no multiple entry points
3. **Future-proof**: Easy to add more bundlers following the same pattern
4. **Maintains compatibility**: Zero breaking changes for existing users
5. **Faster to implement**: 4-7 hours vs 6-10 hours with multiple entry points
6. **Easier to maintain**: One entry point, one build output, simpler configuration

The migration is straightforward, low-risk, and provides immediate benefits in code organization and maintainability without adding complexity.

---

## Next Steps

If approved, I can:

1. Create detailed file-by-file migration checklist
2. Implement the restructuring with a single PR
3. Add comprehensive tests to verify backward compatibility
4. Update all documentation

Would you like me to proceed with the implementation?

