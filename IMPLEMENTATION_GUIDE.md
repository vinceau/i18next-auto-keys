# Implementation Guide: Webpack/Rollup Separation

This guide provides step-by-step instructions for implementing the proposed structure changes with a **single entry point approach**.

## Pre-Implementation Checklist

- [ ] All tests currently passing
- [ ] No uncommitted changes
- [ ] Create a new branch: `git checkout -b refactor/bundler-separation`
- [ ] Backup current state (optional but recommended)

---

## Phase 1: Source Code Restructure (1-2 hours)

### Step 1.1: Create New Directory Structure

```bash
# Create webpack directory
mkdir -p src/webpack/tests

# Create rollup directory
mkdir -p src/rollup/tests
```

### Step 1.2: Move Webpack Files

```bash
# Move loader
git mv src/loaders/i18nextAutoKeyLoader.ts src/webpack/loader.ts
git mv src/loaders/tests/i18nextAutoKeyLoader.integration.test.ts src/webpack/tests/loader.integration.test.ts
git mv src/loaders/tests/i18nextAutoKeyLoader.pipeline.test.ts src/webpack/tests/loader.pipeline.test.ts
git mv src/loaders/tests/helpers src/webpack/tests/helpers
rmdir src/loaders/tests
rmdir src/loaders

# Move webpack plugin
git mv src/plugins/i18nextAutoKeyEmitPlugin.ts src/webpack/plugin.ts
git mv src/plugins/emitIfChanged.ts src/webpack/emitIfChanged.ts
git mv src/plugins/tests/i18nextAutoKeyEmitPlugin.test.ts src/webpack/tests/plugin.test.ts
git mv src/plugins/tests/i18nextAutoKeyEmitPlugin.integration.test.ts src/webpack/tests/plugin.integration.test.ts
```

### Step 1.3: Move Rollup Files

```bash
# Move rollup plugin
git mv src/plugins/i18nextAutoKeyRollupPlugin.ts src/rollup/plugin.ts
git mv src/plugins/tests/i18nextAutoKeyRollupPlugin.test.ts src/rollup/tests/plugin.test.ts

# Clean up old plugins directory
rmdir src/plugins/tests
rmdir src/plugins
```

### Step 1.4: Update Import Paths in Webpack Files

**File: `src/webpack/loader.ts`**
```typescript
// Paths should still be correct (../ goes up one level):
import { createI18nextAutoKeyTransformerFactory } from "../transformers/i18nextAutoKeyTransformer";
import { i18nStore } from "../common/i18nStore";
import { loadConfig } from "../common/config/loadConfig";
```

**File: `src/webpack/plugin.ts`**
```typescript
// Update the emitIfChanged import:
import { i18nStore } from "../common/i18nStore";
import { emitIfChanged } from "./emitIfChanged";  // Changed from "../plugins/emitIfChanged"
import { loadConfig } from "../common/config/loadConfig";
```

**File: `src/webpack/emitIfChanged.ts`**
```typescript
// No imports to update - just internal webpack utilities
```

### Step 1.5: Update Import Paths in Rollup Files

**File: `src/rollup/plugin.ts`**
```typescript
// Paths should still be correct:
import { createI18nextAutoKeyTransformerFactory } from "../transformers/i18nextAutoKeyTransformer";
import { i18nStore } from "../common/i18nStore";
import { loadConfig } from "../common/config/loadConfig";
```

### Step 1.6: Update Test Files

Update import paths in all moved test files:

- `src/webpack/tests/loader.integration.test.ts`
- `src/webpack/tests/loader.pipeline.test.ts`
- `src/webpack/tests/plugin.test.ts`
- `src/webpack/tests/plugin.integration.test.ts`
- `src/rollup/tests/plugin.test.ts`

**Example changes:**
```typescript
// OLD:
import { i18nextAutoKeyLoader } from "../i18nextAutoKeyLoader";
import { I18nextAutoKeyEmitPlugin } from "../i18nextAutoKeyEmitPlugin";

// NEW:
import { i18nextAutoKeyLoader } from "../loader";
import { I18nextAutoKeyEmitPlugin } from "../plugin";
```

### Step 1.7: Update Main Entry Point

**File: `src/index.ts`**

Update to import from the new namespaced locations:

```typescript
/**
 * Main entry point for i18next-auto-keys
 * Provides webpack and rollup exports through a single entry point
 */

import { i18nextAutoKeyLoader } from "./webpack/loader";
import { I18nextAutoKeyEmitPlugin } from "./webpack/plugin";
import { i18nextAutoKeyRollupPlugin } from "./rollup/plugin";
import { createI18nextAutoKeyTransformerFactory } from "./transformers/i18nextAutoKeyTransformer";
import { i18nStore } from "./common/i18nStore";
import { loadConfig } from "./common/config/loadConfig";
import { stableHash } from "./common/hash";

// Webpack loader compatibility: Export loader as default, plugin as property
module.exports = i18nextAutoKeyLoader;
module.exports.I18nextAutoKeyEmitPlugin = I18nextAutoKeyEmitPlugin;
module.exports.i18nextAutoKeyLoader = i18nextAutoKeyLoader;
module.exports.i18nextAutoKeyRollupPlugin = i18nextAutoKeyRollupPlugin;

// Shared functionality for CLI and advanced users
module.exports.createI18nextAutoKeyTransformerFactory = createI18nextAutoKeyTransformerFactory;
module.exports.i18nStore = i18nStore;
module.exports.loadConfig = loadConfig;
module.exports.stableHash = stableHash;

// Also provide TypeScript-friendly named exports for better DX
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

### Step 1.8: Verify Imports

Run a quick check to ensure no broken imports:

```bash
# Check for any remaining old import paths
grep -r 'from "\.\/loaders\/' src/
grep -r 'from "\.\/plugins\/' src/
grep -r 'from "\.\.\/loaders\/' src/
grep -r 'from "\.\.\/plugins\/' src/

# Should return no results (or only comments/documentation)
```

### Step 1.9: Run Unit Tests

```bash
npm test

# All tests should pass after import path updates
```

---

## Phase 2: Verify Build Configuration (10 min)

### Step 2.1: Verify Build Works

```bash
npm run build
```

The existing build configuration should work without changes since we're keeping the single entry point.

### Step 2.2: Verify Output

```bash
ls -la dist/

# Should see:
# - index.js (main bundle)
# - index.d.ts (type declarations)
# - cli.js (CLI binary)
```

No changes to package.json needed - the main entry point is still `dist/index.js`.

---

## Phase 3: Restructure E2E Tests (2-3 hours)

### Step 3.1: Create E2E Directory Structure

```bash
# Create new directories
mkdir -p e2e/shared/src
mkdir -p e2e/webpack/src
mkdir -p e2e/webpack/tests
mkdir -p e2e/rollup/src
mkdir -p e2e/rollup/tests
mkdir -p e2e/vite/src
mkdir -p e2e/vite/tests
```

### Step 3.2: Move Shared Test Fixtures

```bash
# Move message files to shared location
git mv e2e/src/auth.messages.ts e2e/shared/src/
git mv e2e/src/auth-indexed.messages.ts e2e/shared/src/
git mv e2e/src/ui.messages.ts e2e/shared/src/
git mv e2e/src/ui-indexed.messages.ts e2e/shared/src/
git mv e2e/src/replay-browser.messages.ts e2e/shared/src/
git mv e2e/src/replay-browser-indexed.messages.ts e2e/shared/src/
git mv e2e/src/context.messages.ts e2e/shared/src/
```

### Step 3.3: Move Webpack-Specific Files

```bash
# Move webpack test entry points
git mv e2e/src/index.ts e2e/webpack/src/
git mv e2e/src/icu-index.ts e2e/webpack/src/

# Move webpack tests
git mv e2e/tests e2e/webpack/tests

# Move webpack config
git mv e2e/webpack-configs.ts e2e/webpack/

# Move webpack package files
git mv e2e/package.json e2e/webpack/package.json
git mv e2e/package-lock.json e2e/webpack/package-lock.json
git mv e2e/jest.config.js e2e/webpack/jest.config.js
git mv e2e/tsconfig.json e2e/webpack/tsconfig.json

# Remove old src directory
rmdir e2e/src
```

### Step 3.4: Update Webpack Test Imports

**In `e2e/webpack/src/index.ts` and `e2e/webpack/src/icu-index.ts`:**

```typescript
// OLD:
import { AuthMessages } from "./auth.messages";
import { UiMessages } from "./ui.messages";

// NEW:
import { AuthMessages } from "../../shared/src/auth.messages";
import { UiMessages } from "../../shared/src/ui.messages";
```

**In `e2e/webpack/webpack-configs.ts`:**

```typescript
// Update the path to the built package
const { I18nextAutoKeyEmitPlugin } = require("../../dist/index.js");

// Update resolve alias for indexed messages
resolveAlias: {
  "./auth.messages": path.resolve(__dirname, "../shared/src/auth-indexed.messages.ts"),
  "./ui.messages": path.resolve(__dirname, "../shared/src/ui-indexed.messages.ts"),
}
```

### Step 3.5: Create Rollup E2E Tests

**File: `e2e/rollup/package.json` (NEW)**
```json
{
  "name": "i18next-auto-keys-e2e-rollup",
  "version": "1.0.0",
  "private": true,
  "description": "Rollup E2E tests for i18next-auto-keys",
  "scripts": {
    "test": "jest --runInBand",
    "build": "rollup -c"
  },
  "dependencies": {
    "i18next": "^23.16.8"
  },
  "devDependencies": {
    "@types/jest": "^29",
    "jest": "^29",
    "rollup": "^4",
    "ts-jest": "^29.4.5",
    "typescript": "^5"
  }
}
```

**File: `e2e/rollup/rollup.config.js` (NEW)**
```javascript
import path from "path";
import { i18nextAutoKeyRollupPlugin } from "../../dist/index.js";

export default {
  input: "./src/index.ts",
  output: {
    file: "dist/bundle.js",
    format: "cjs",
  },
  plugins: [
    i18nextAutoKeyRollupPlugin({
      jsonOutputPath: "locales/en.json",
      include: [/\.messages\.(ts|tsx)$/],
    }),
  ],
};
```

**File: `e2e/rollup/src/index.ts` (NEW)**
```typescript
import i18next from "i18next";
import path from "path";
import fs from "fs";
import { AuthMessages } from "../../shared/src/auth.messages";
import { UiMessages } from "../../shared/src/ui.messages";

export async function initializeI18n(localesDir: string) {
  const enPath = path.join(localesDir, "en.json");
  const translations = JSON.parse(fs.readFileSync(enPath, "utf8"));

  await i18next.init({
    lng: "en",
    resources: {
      en: { translation: translations },
    },
  });
}

export function getMessages() {
  return {
    welcome: AuthMessages.welcome("Rollup"),
    title: UiMessages.title(),
    loading: UiMessages.loading(),
  };
}
```

**File: `e2e/rollup/tests/rollup.e2e.test.ts` (NEW)**
```typescript
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

describe("Rollup E2E Tests", () => {
  const distPath = path.resolve(__dirname, "../dist");

  beforeAll(() => {
    // Clean and build
    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true });
    }
    execSync("npm run build", { cwd: path.resolve(__dirname, "..") });
  });

  it("should build successfully", () => {
    expect(fs.existsSync(path.join(distPath, "bundle.js"))).toBe(true);
  });

  it("should generate translations", () => {
    const translationsPath = path.join(distPath, "locales/en.json");
    expect(fs.existsSync(translationsPath)).toBe(true);

    const translations = JSON.parse(fs.readFileSync(translationsPath, "utf8"));
    expect(Object.keys(translations).length).toBeGreaterThan(0);
  });

  it("should transform message calls", () => {
    const bundleContent = fs.readFileSync(path.join(distPath, "bundle.js"), "utf8");
    expect(bundleContent).toContain("i18next.t(");
  });
});
```

**File: `e2e/rollup/jest.config.js` (NEW)**
```javascript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
};
```

**File: `e2e/rollup/tsconfig.json` (NEW)**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["src/**/*", "tests/**/*", "../shared/src/**/*"]
}
```

### Step 3.6: Create Vite E2E Tests

Follow similar pattern as Rollup but with Vite-specific config:

**File: `e2e/vite/vite.config.js` (NEW)**
```javascript
import { defineConfig } from 'vite';
import path from 'path';
import { i18nextAutoKeyRollupPlugin } from '../../dist/index.js';

export default defineConfig({
  plugins: [
    i18nextAutoKeyRollupPlugin({
      jsonOutputPath: 'locales/en.json',
      include: [/\.messages\.(ts|tsx)$/],
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['cjs'],
    },
  },
});
```

(Add similar package.json, tests, etc. as rollup)

### Step 3.7: Update Root E2E Test Script

**File: `package.json` (root)**
```json
{
  "scripts": {
    "test:e2e": "npm run build && npm run test:e2e:webpack && npm run test:e2e:rollup && npm run test:e2e:vite",
    "test:e2e:webpack": "cd e2e/webpack && npm install && npm test",
    "test:e2e:rollup": "cd e2e/rollup && npm install && npm test",
    "test:e2e:vite": "cd e2e/vite && npm install && npm test"
  }
}
```

---

## Phase 4: Update Documentation (30 min)

### Step 4.1: Update Main README

Update the README to mention the new structure (no API changes needed):

```markdown
## Project Structure

The source code is organized by bundler:
- `src/webpack/` - Webpack loader and plugin
- `src/rollup/` - Rollup/Vite plugin
- `src/transformers/` - Shared AST transformation
- `src/common/` - Shared utilities
- `src/cli/` - CLI tools

All exports are available from the main entry point:
\`\`\`javascript
const { I18nextAutoKeyEmitPlugin } = require('i18next-auto-keys');
import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys';
\`\`\`
```

### Step 4.2: Update USAGE_VITE_ROLLUP.md

Update if needed to reflect the new internal structure (though user-facing API hasn't changed).

### Step 4.3: Update Examples

Verify examples still work (they should, as imports haven't changed).

---

## Phase 5: Testing & Validation (1 hour)

### Step 5.1: Run All Unit Tests

```bash
npm test
```

All unit tests should pass.

### Step 5.2: Run All E2E Tests

```bash
npm run test:e2e
```

All E2E tests should pass (webpack, rollup, vite).

### Step 5.3: Test Build Output

```bash
npm run build

# Verify output structure
ls -la dist/

# Test that the built package works
node -e "const pkg = require('./dist/index.js'); console.log(pkg)"
```

### Step 5.4: Verify TypeScript Types

```bash
# Check that types are generated correctly
cat dist/index.d.ts

# Should export all the expected types
```

---

## Post-Implementation

### Commit Strategy

```bash
# Option A: Single commit
git add .
git commit -m "refactor: separate webpack and rollup into distinct namespaces

- Move webpack loader and plugin to src/webpack/
- Move rollup plugin to src/rollup/
- Restructure E2E tests by bundler (webpack/, rollup/, vite/)
- Create shared E2E fixtures in e2e/shared/
- Add rollup and vite E2E tests
- Update all import paths
- Maintain single entry point for simplicity

No breaking changes - all imports remain the same.
"

# Option B: Multiple logical commits (preferred for review)
git add src/webpack src/rollup
git commit -m "refactor: move bundler-specific code to namespaced directories"

git add src/index.ts
git commit -m "refactor: update main entry point imports"

git add e2e/
git commit -m "refactor: restructure E2E tests by bundler"

git add README.md examples/
git commit -m "docs: update documentation for new structure"
```

### Create Pull Request

```markdown
## Refactor: Separate Webpack and Rollup Concerns

### Summary
Restructures the project to clearly separate webpack and rollup/vite-specific code into distinct namespaces, improving maintainability and scalability.

### Changes
- ✅ Moved webpack code to `src/webpack/`
- ✅ Moved rollup code to `src/rollup/`
- ✅ Restructured E2E tests by bundler
- ✅ Added rollup and vite E2E tests
- ✅ Updated internal imports
- ✅ Kept single entry point for simplicity
- ✅ Updated documentation

### Backward Compatibility
✅ **100% backward compatible** - all existing imports continue to work

### Testing
- ✅ All unit tests passing
- ✅ All E2E tests passing (webpack, rollup, vite)
- ✅ Build output verified
- ✅ TypeScript types correct
```

---

## Rollback Plan

If issues arise:

```bash
# Rollback to previous state
git checkout main

# Or revert the changes
git revert <commit-hash>
```

The migration is **low risk** because:
1. No breaking changes to public API
2. All tests validate functionality
3. Clear commit history for easy revert
4. Single entry point unchanged

---

## Success Criteria

- [ ] All unit tests pass
- [ ] All E2E tests pass (webpack, rollup, vite)
- [ ] Build produces expected files
- [ ] Old import paths still work
- [ ] Documentation is updated
- [ ] TypeScript types are correct
- [ ] No breaking changes for users

---

## Timeline Summary

| Phase | Duration | Key Tasks |
|-------|----------|-----------|
| Phase 1: Source code | 1-2 hours | Move files, update imports |
| Phase 2: Build verification | 10 min | Verify build works |
| Phase 3: E2E tests | 2-3 hours | Restructure, add new tests |
| Phase 4: Documentation | 30 min | Update docs |
| Phase 5: Testing | 1 hour | Final validation |
| **Total** | **4-7 hours** | Complete migration |

---

## Need Help?

If you encounter issues during implementation:

1. **Import errors**: Check that paths use `../` correctly from new locations
2. **Test failures**: Verify test imports were updated
3. **Build issues**: Ensure webpack config still points to `src/index.ts`
4. **E2E failures**: Check that shared fixtures are imported correctly

Most issues will be simple path corrections!
