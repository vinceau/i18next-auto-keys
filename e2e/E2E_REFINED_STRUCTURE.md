# E2E Structure - Refined with Co-located Configs

## The Question

> "I think the config used in the tests should be with the tests. If the config used in the tests are co-located with the tests, would we still need the configs folder or can those configs just live in the root?"

**Answer: You're right! This is cleaner.** ✅

---

## Refined Structure

```
e2e/
├── package.json                    ← All dependencies & scripts
├── jest.config.js                  ← Shared test config
├── tsconfig.json                   ← Shared TypeScript config
├── webpack.config.js               ← Build config (used by npm script)
├── rollup.config.js                ← Build config (used by npm script)
│
├── fixtures/                       ← Shared test sources
│   ├── messages/
│   │   └── *.messages.ts
│   ├── index.ts
│   └── icu-index.ts
│
├── tests/                          ← Tests + their helpers
│   ├── cli/
│   │   ├── cli.e2e.test.ts
│   │   └── config.e2e.test.ts
│   │
│   ├── webpack/
│   │   ├── e2e.test.ts             ← Test file
│   │   ├── icu.e2e.test.ts         ← Test file
│   │   └── webpack-configs.ts      ← Test helper (co-located!) ✨
│   │
│   └── rollup/
│       ├── e2e.test.ts             ← Test file
│       ├── icu.e2e.test.ts         ← Test file
│       └── rollup-configs.ts       ← Test helper (co-located!) ✨
│
└── dist/                           ← Build outputs
    ├── webpack/
    ├── rollup/
    └── cli/
```

---

## Two Types of Configs

### 1. Build Configs (Root Level)

**Purpose:** Used by npm scripts to build the default bundles

**Location:** `e2e/webpack.config.js`, `e2e/rollup.config.js`

**Usage:**
```json
{
  "scripts": {
    "build:webpack": "webpack --config webpack.config.js",
    "build:rollup": "rollup --config rollup.config.js"
  }
}
```

**Why in root:**
- ✅ Standard bundler convention (configs at project root)
- ✅ Shorter paths in npm scripts
- ✅ Easy to find and edit
- ✅ Not test-specific

---

### 2. Test Helper Configs (With Tests)

**Purpose:** Helper functions for tests to create dynamic configs

**Location:** `e2e/tests/webpack/webpack-configs.ts`, `e2e/tests/rollup/rollup-configs.ts`

**Usage:**
```typescript
// tests/webpack/e2e.test.ts
import { createWebpackConfig } from "./webpack-configs";  // ← Same directory!

it("should work with long hashes", async () => {
  const config = createWebpackConfig({
    hashLength: 16,
    outputFile: "bundle-long-hashes.js"
  });
  
  await webpack(config);
  // assertions...
});
```

**Why with tests:**
- ✅ **Co-location principle** - test helpers live with tests
- ✅ Easier to find when reading/writing tests
- ✅ Clear which configs are test-specific
- ✅ Short import paths in test files

---

## Comparison: Before vs After

### Original Proposal (Separate configs/ folder)

```
e2e/
├── configs/                        ← Extra nesting
│   ├── webpack/
│   │   ├── webpack.config.js      ← Build config
│   │   └── webpack-configs.ts     ← Test helper
│   └── rollup/
│       ├── rollup.config.js       ← Build config
│       └── rollup-configs.ts      ← Test helper
│
└── tests/
    ├── webpack/
    │   └── e2e.test.ts
    │       import from "../../configs/webpack/webpack-configs"  ← Long path
    └── rollup/
        └── e2e.test.ts
            import from "../../configs/rollup/rollup-configs"    ← Long path
```

**Downsides:**
- ❌ Extra nesting (configs/ directory)
- ❌ Test helpers separated from tests
- ❌ Longer import paths
- ❌ Less discoverable

---

### Refined Proposal (Co-located) ✨

```
e2e/
├── webpack.config.js              ← Build config (at root)
├── rollup.config.js               ← Build config (at root)
│
└── tests/
    ├── webpack/
    │   ├── e2e.test.ts
    │   └── webpack-configs.ts     ← Test helper (with test!)
    │       import from "./webpack-configs"  ← Short path!
    │
    └── rollup/
        ├── e2e.test.ts
        └── rollup-configs.ts      ← Test helper (with test!)
            import from "./rollup-configs"   ← Short path!
```

**Benefits:**
- ✅ No extra nesting
- ✅ Test helpers with tests (co-location)
- ✅ Shorter import paths
- ✅ More discoverable
- ✅ Follows standard conventions

---

## Import Paths Comparison

### Webpack Test Imports

**With separate configs/ folder:**
```typescript
// tests/webpack/e2e.test.ts
import { createWebpackConfig } from "../../configs/webpack/webpack-configs";
import { AuthMessages } from "../../fixtures/messages/auth.messages";
```

**With co-located configs:**
```typescript
// tests/webpack/e2e.test.ts
import { createWebpackConfig } from "./webpack-configs";  // ✨ Same dir!
import { AuthMessages } from "../../fixtures/messages/auth.messages";
```

---

## Build Config Usage

### In package.json

```json
{
  "scripts": {
    "build:webpack": "webpack --config webpack.config.js",
    "build:rollup": "rollup --config rollup.config.js"
  }
}
```

**Clean and standard!** No nested paths.

### Standard Convention

Most projects have build configs at the root:
```
my-project/
├── webpack.config.js      ← Standard
├── rollup.config.js       ← Standard
├── vite.config.js         ← Standard
└── src/
```

Our e2e folder is essentially a mini-project, so same convention applies:
```
e2e/
├── webpack.config.js      ← Standard for this "project"
├── rollup.config.js       ← Standard for this "project"
├── fixtures/
└── tests/
```

---

## Complete Structure Comparison

### With configs/ folder (Original)

```
e2e/
├── package.json
├── fixtures/
├── configs/                    ← Extra directory
│   ├── webpack/
│   │   ├── webpack.config.js
│   │   └── webpack-configs.ts
│   └── rollup/
│       ├── rollup.config.js
│       └── rollup-configs.ts
├── tests/
│   ├── webpack/
│   │   └── e2e.test.ts
│   └── rollup/
│       └── e2e.test.ts
└── dist/

Depth: 3 levels (e2e/configs/webpack/)
```

---

### Without configs/ folder (Refined) ✨

```
e2e/
├── package.json
├── webpack.config.js           ← At root
├── rollup.config.js            ← At root
├── fixtures/
├── tests/
│   ├── webpack/
│   │   ├── e2e.test.ts
│   │   └── webpack-configs.ts  ← With tests
│   └── rollup/
│       ├── e2e.test.ts
│       └── rollup-configs.ts   ← With tests
└── dist/

Depth: 2 levels (e2e/tests/webpack/)
```

**Benefits:**
- ✅ One less directory level
- ✅ Build configs at root (standard)
- ✅ Test helpers with tests (co-location)
- ✅ Cleaner, more intuitive

---

## Principle: Co-location

### Good: Test Helpers with Tests

```
tests/webpack/
├── e2e.test.ts
├── icu.e2e.test.ts
└── webpack-configs.ts          ← Helper used by these tests

import { createWebpackConfig } from "./webpack-configs";  ✨
```

**Why good:**
- Easy to find when working on tests
- Clear relationship (helper → test)
- Short import paths
- Easy to modify together

### Bad: Test Helpers Separated

```
configs/webpack/
└── webpack-configs.ts          ← Far from tests

tests/webpack/
├── e2e.test.ts
└── icu.e2e.test.ts

import { createWebpackConfig } from "../../configs/webpack/webpack-configs";  ❌
```

**Why bad:**
- Hard to discover
- Unclear relationship
- Long import paths
- Harder to modify together

---

## Summary

### Refined Structure

**Build configs** → Root level (`e2e/webpack.config.js`)
- Used by npm scripts
- Standard convention
- Easy to find

**Test helpers** → With tests (`e2e/tests/webpack/webpack-configs.ts`)
- Co-located with tests
- Short import paths
- Clear relationship

**No `configs/` directory needed!** ✨

---

## Migration Impact

### What Changes

**From original proposal:**
```diff
e2e/
- ├── configs/
- │   ├── webpack/
- │   │   ├── webpack.config.js
- │   │   └── webpack-configs.ts
- │   └── rollup/
- │       ├── rollup.config.js
- │       └── rollup-configs.ts
+ ├── webpack.config.js
+ ├── rollup.config.js
  ├── tests/
  │   ├── webpack/
  │   │   ├── e2e.test.ts
+ │   │   └── webpack-configs.ts
  │   └── rollup/
  │       ├── e2e.test.ts
+ │       └── rollup-configs.ts
```

### Import Changes

**Tests:**
```diff
- import { createWebpackConfig } from "../../configs/webpack/webpack-configs";
+ import { createWebpackConfig } from "./webpack-configs";
```

**package.json:**
```diff
  "scripts": {
-   "build:webpack": "webpack --config configs/webpack/webpack.config.js",
+   "build:webpack": "webpack --config webpack.config.js",
  }
```

---

## Recommendation

✅ **Use the refined structure (no configs/ folder)**

**Why:**
1. **Standard convention** - Build configs at root
2. **Co-location** - Test helpers with tests
3. **Simpler** - One less directory level
4. **Shorter imports** - `./webpack-configs` vs `../../configs/webpack/webpack-configs`
5. **More intuitive** - Easier to understand

This is the cleanest approach! 🎉

