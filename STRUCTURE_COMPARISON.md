# Structure Comparison: Current vs Proposed

## Current Structure (After Rollup Support Added)

```
src/
├── index.ts                              # Mixed webpack + rollup exports
├── cli/                                  # ✅ Shared (bundler-agnostic)
├── common/                               # ✅ Shared (bundler-agnostic)
├── transformers/                         # ✅ Shared (bundler-agnostic)
├── loaders/                              # ⚠️  Webpack-specific but not clear
│   ├── i18nextAutoKeyLoader.ts
│   └── tests/
└── plugins/                              # ⚠️  MIXED webpack + rollup
    ├── i18nextAutoKeyEmitPlugin.ts       # Webpack only
    ├── emitIfChanged.ts                  # Webpack only
    ├── i18nextAutoKeyRollupPlugin.ts     # Rollup/Vite only
    └── tests/
        ├── i18nextAutoKeyEmitPlugin.test.ts
        ├── i18nextAutoKeyEmitPlugin.integration.test.ts
        └── i18nextAutoKeyRollupPlugin.test.ts

e2e/
├── src/                                  # Webpack test fixtures
├── tests/                                # Webpack E2E tests only
│   ├── e2e.test.ts
│   ├── icu.e2e.test.ts
│   ├── cli.e2e.test.ts
│   └── config.simple.e2e.test.ts
├── webpack-configs.ts
└── package.json

examples/
├── rollup-example/
│   └── rollup.config.js
└── vite-example/
    └── vite.config.js
```

**Issues:**
- 🔴 `/plugins` mixes webpack and rollup concerns
- 🔴 `/loaders` is webpack-specific but not obviously so
- 🔴 E2E tests only cover webpack
- 🔴 No clear pattern for adding new bundlers

---

## Proposed Structure (Clean Separation)

```
src/
├── index.ts                              # Single entry (exports all)
├── cli/                                  # ✅ Shared (bundler-agnostic)
├── common/                               # ✅ Shared (bundler-agnostic)
├── transformers/                         # ✅ Shared (bundler-agnostic)
├── webpack/                              # 🆕 Clear webpack namespace
│   ├── loader.ts                         # (from loaders/i18nextAutoKeyLoader.ts)
│   ├── plugin.ts                         # (from plugins/i18nextAutoKeyEmitPlugin.ts)
│   ├── emitIfChanged.ts                  # (from plugins/emitIfChanged.ts)
│   └── tests/
│       ├── loader.integration.test.ts
│       ├── loader.pipeline.test.ts
│       ├── plugin.test.ts
│       └── plugin.integration.test.ts
└── rollup/                               # 🆕 Clear rollup namespace
    ├── plugin.ts                         # (from plugins/i18nextAutoKeyRollupPlugin.ts)
    └── tests/
        └── plugin.test.ts

e2e/
├── shared/                               # 🆕 Shared test fixtures
│   └── src/
│       ├── auth.messages.ts
│       ├── auth-indexed.messages.ts
│       ├── ui.messages.ts
│       ├── ui-indexed.messages.ts
│       ├── replay-browser.messages.ts
│       ├── replay-browser-indexed.messages.ts
│       └── context.messages.ts
├── webpack/                              # 🆕 Webpack-specific E2E
│   ├── src/
│   │   ├── index.ts
│   │   └── icu-index.ts
│   ├── tests/
│   │   ├── e2e.test.ts
│   │   ├── icu.e2e.test.ts
│   │   ├── cli.e2e.test.ts
│   │   └── config.simple.e2e.test.ts
│   ├── webpack-configs.ts
│   └── package.json
├── rollup/                               # 🆕 Rollup-specific E2E
│   ├── src/
│   │   └── index.ts
│   ├── tests/
│   │   └── rollup.e2e.test.ts
│   ├── rollup.config.js
│   └── package.json
└── vite/                                 # 🆕 Vite-specific E2E
    ├── src/
    │   └── index.ts
    ├── tests/
    │   └── vite.e2e.test.ts
    ├── vite.config.js
    └── package.json

examples/
├── README.md
├── webpack-example/                      # 🆕 Added for completeness
│   └── webpack.config.js
├── rollup-example/
│   └── rollup.config.js
└── vite-example/
    └── vite.config.js
```

**Benefits:**
- ✅ Clear namespace separation (webpack/ vs rollup/)
- ✅ E2E tests match the bundler they test
- ✅ Shared fixtures eliminate duplication
- ✅ Pattern for adding new bundlers (just add `src/esbuild/`, `e2e/esbuild/`)
- ✅ Single entry point - simple build
- ✅ Backward compatible

---

## Import Path Comparison

### Current Import Paths

```javascript
// Webpack
const { I18nextAutoKeyEmitPlugin } = require('i18next-auto-keys');
module.exports = {
  module: {
    rules: [{ loader: 'i18next-auto-keys' }]
  }
};

// Rollup
import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys';
```

### Proposed Import Paths

```javascript
// Webpack - SAME AS BEFORE (backward compatible)
const { I18nextAutoKeyEmitPlugin } = require('i18next-auto-keys');
module.exports = {
  module: {
    rules: [{ loader: 'i18next-auto-keys' }]
  }
};

// Rollup - SAME AS BEFORE (backward compatible)
import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys';
```

**Key Point:** Import paths don't change! Users see zero difference. All benefits are internal to the codebase.

---

## File Size Impact

### Current Distribution
```
dist/
├── index.js          (~50KB including webpack + rollup code)
├── index.d.ts
└── cli.js
```

### Proposed Distribution
```
dist/
├── index.js          (~50KB including webpack + rollup code) - SAME
├── index.d.ts        - SAME
└── cli.js            - SAME
```

**Result:** No change in distribution size. Benefits are all in source organization.

---

## Test Coverage Comparison

### Current Test Coverage
- ✅ Webpack loader unit tests
- ✅ Webpack plugin unit tests
- ✅ Webpack E2E tests (comprehensive)
- ✅ Rollup plugin unit tests
- ❌ Rollup E2E tests (missing!)
- ❌ Vite E2E tests (missing!)

### Proposed Test Coverage
- ✅ Webpack loader unit tests (`src/webpack/tests/`)
- ✅ Webpack plugin unit tests (`src/webpack/tests/`)
- ✅ Webpack E2E tests (`e2e/webpack/`)
- ✅ Rollup plugin unit tests (`src/rollup/tests/`)
- ✅ Rollup E2E tests (`e2e/rollup/`) **NEW!**
- ✅ Vite E2E tests (`e2e/vite/`) **NEW!**

---

## Package.json Comparison

### Current
```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

### Proposed
```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

**No changes needed!** Simple package.json configuration.

---

## Adding a New Bundler (Example: esbuild)

### Current Approach (Unclear)
1. Add `src/plugins/i18nextAutoKeyEsbuildPlugin.ts`
2. `/plugins` directory becomes even more crowded
3. Update `src/index.ts` with yet another export
4. No clear E2E test pattern

### Proposed Approach (Clear Pattern)
1. Create `src/esbuild/` directory
2. Add `src/esbuild/plugin.ts`
3. Add `src/esbuild/tests/plugin.test.ts`
4. Add export to `src/index.ts`
5. Add `e2e/esbuild/` directory
6. Follow the established pattern!

**Pattern is clear and consistent!**

---

## Build Configuration Comparison

### Current Build Config
```javascript
// webpack.build.config.js
module.exports = {
  entry: {
    index: './src/index.ts',
    cli: './src/cli/cli.ts',
  },
  // ... rest of config
};
```

### Proposed Build Config
```javascript
// webpack.build.config.js
module.exports = {
  entry: {
    index: './src/index.ts',
    cli: './src/cli/cli.ts',
  },
  // ... rest of config
};
```

**No changes needed!** Same simple build configuration.

---

## Migration Checklist

- [ ] Create new directory structure (`src/webpack/`, `src/rollup/`)
- [ ] Move webpack files to `src/webpack/`
- [ ] Move rollup files to `src/rollup/`
- [ ] Update `src/index.ts` imports only
- [ ] Update all internal imports
- [ ] Move webpack E2E to `e2e/webpack/`
- [ ] Create `e2e/shared/` with fixtures
- [ ] Create `e2e/rollup/` with tests
- [ ] Create `e2e/vite/` with tests
- [ ] Run all unit tests (should pass)
- [ ] Run all E2E tests (should pass)
- [ ] Update README.md
- [ ] Update USAGE_VITE_ROLLUP.md

---

## Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| Phase 1: Source restructure | 1-2 hours | Move files, update imports |
| Phase 2: Build verification | 10 min | Verify build still works |
| Phase 3: E2E restructure | 2-3 hours | Move tests, add rollup/vite E2E |
| Phase 4: Documentation | 30 min | README, guides |
| Phase 5: Testing | 1 hour | Validate everything works |
| **Total** | **4-7 hours** | Full migration with testing |

---

## Conclusion

The proposed structure provides:

1. **Clear organization** - Bundler code is isolated and easy to find
2. **Backward compatibility** - Zero changes for users
3. **Scalability** - Easy to add new bundlers
4. **Better testing** - E2E tests match what they test
5. **Simplicity** - Single entry point, simple build
6. **Consistency** - Established pattern for all bundlers

**Recommendation: Implement namespace organization with single entry point**

This gives you all the maintainability benefits without adding complexity.
