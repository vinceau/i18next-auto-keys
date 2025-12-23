# E2E Test Examples - Before & After

This document shows concrete examples of how test files will change after the restructuring.

---

## Example 1: Webpack E2E Test

### BEFORE: `e2e/webpack/tests/e2e.test.ts`

```typescript
import webpack from "webpack";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import i18next from "i18next";

// Importing from duplicated src/ directory
import { AuthMessages } from "../src/auth.messages";
import { UiMessages } from "../src/ui.messages";
import { ReplayBrowserMessages } from "../src/replay-browser.messages";

const webpackAsync = promisify(webpack);

describe("Webpack E2E Tests", () => {
  it("should transform auth messages", async () => {
    const config = createWebpackConfig({
      configName: "default",
      entry: "./src/index.ts",  // Points to local src/
      // ...
    });
    
    // Test implementation
  });
});
```

### AFTER: `e2e/webpack/tests/e2e.test.ts`

```typescript
import webpack from "webpack";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import i18next from "i18next";

// Importing from shared fixtures/ directory
import { AuthMessages } from "../../fixtures/messages/auth.messages";
import { UiMessages } from "../../fixtures/messages/ui.messages";
import { ReplayBrowserMessages } from "../../fixtures/messages/replay-browser.messages";

const webpackAsync = promisify(webpack);

describe("Webpack E2E Tests", () => {
  it("should transform auth messages", async () => {
    const config = createWebpackConfig({
      configName: "default",
      entry: "../fixtures/index.ts",  // Points to shared fixtures/
      // ...
    });
    
    // Test implementation (unchanged)
  });
});
```

**Changes:**
- ✏️ Import paths: `../src/` → `../../fixtures/messages/`
- ✏️ Config entry: `./src/index.ts` → `../fixtures/index.ts`
- ✅ Test logic: No changes

---

## Example 2: Rollup E2E Test

### BEFORE: `e2e/rollup/tests/e2e.test.ts`

```typescript
import { rollup } from "rollup";
import fs from "fs";
import path from "path";
import i18next from "i18next";

// Importing from duplicated src/ directory (identical to webpack!)
import { AuthMessages } from "../src/auth.messages";
import { UiMessages } from "../src/ui.messages";

describe("Rollup E2E Tests", () => {
  it("should transform auth messages", async () => {
    const config = createRollupConfig({
      configName: "default",
      input: "src/index.ts",  // Points to local src/
      // ...
    });
    
    const bundle = await rollup(config);
    // Test implementation
  });
});
```

### AFTER: `e2e/rollup/tests/e2e.test.ts`

```typescript
import { rollup } from "rollup";
import fs from "fs";
import path from "path";
import i18next from "i18next";

// Importing from shared fixtures/ directory (same as webpack!)
import { AuthMessages } from "../../fixtures/messages/auth.messages";
import { UiMessages } from "../../fixtures/messages/ui.messages";

describe("Rollup E2E Tests", () => {
  it("should transform auth messages", async () => {
    const config = createRollupConfig({
      configName: "default",
      input: "../fixtures/index.ts",  // Points to shared fixtures/
      // ...
    });
    
    const bundle = await rollup(config);
    // Test implementation (unchanged)
  });
});
```

**Changes:**
- ✏️ Import paths: `../src/` → `../../fixtures/messages/`
- ✏️ Config input: `src/index.ts` → `../fixtures/index.ts`
- ✅ Test logic: No changes
- ✅ Now uses same fixtures as webpack!

---

## Example 3: CLI Tests (Moved!)

### BEFORE: `e2e/webpack/tests/cli.e2e.test.ts`

**Issue**: This test is bundler-agnostic but lives in webpack folder!

```typescript
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

describe("CLI E2E Tests", () => {
  const cliPath = path.resolve(__dirname, "../../../dist/cli.js");
  const testDir = path.join(__dirname, "temp-cli-tests");
  
  it("should extract translations from source files", () => {
    // This test doesn't use webpack at all!
    execSync(`node ${cliPath} extract --src ${testDir}/src --out ${testDir}/locales`);
    
    const translations = fs.readFileSync(
      path.join(testDir, "locales/en.json"),
      "utf-8"
    );
    
    expect(JSON.parse(translations)).toHaveProperty("someKey");
  });
  
  it("should sync translations", () => {
    execSync(`node ${cliPath} sync --src ${testDir}/locales/en.json`);
    // Assertions...
  });
});
```

### AFTER: `e2e/cli/tests/cli.e2e.test.ts`

**Fixed**: Now in dedicated CLI directory!

```typescript
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

describe("CLI E2E Tests", () => {
  const cliPath = path.resolve(__dirname, "../../../dist/cli.js");
  const testDir = path.join(__dirname, "temp-cli-tests");
  
  // Test implementation unchanged - just in the right place now!
  
  it("should extract translations from source files", () => {
    execSync(`node ${cliPath} extract --src ${testDir}/src --out ${testDir}/locales`);
    
    const translations = fs.readFileSync(
      path.join(testDir, "locales/en.json"),
      "utf-8"
    );
    
    expect(JSON.parse(translations)).toHaveProperty("someKey");
  });
  
  it("should sync translations", () => {
    execSync(`node ${cliPath} sync --src ${testDir}/locales/en.json`);
    // Assertions...
  });
});
```

**Changes:**
- 📁 Moved: `webpack/tests/` → `cli/tests/`
- ✅ Test logic: No changes
- ✅ Now clearly separate from bundler tests

---

## Example 4: Build Configs

### Webpack Config

**BEFORE: `e2e/webpack/webpack.config.js`**

```javascript
const path = require("path");

module.exports = {
  mode: "production",
  entry: "./src/index.ts",  // Local src/
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    libraryTarget: "commonjs2",
  },
  module: {
    rules: [
      {
        test: /\.messages\.(ts|tsx)$/,
        include: path.resolve(__dirname, "src"),  // Local src/
        use: [
          {
            loader: "i18next-auto-keys",
            options: {
              include: /\.messages\.(ts|tsx)$/,
            },
          },
        ],
      },
    ],
  },
  // ...
};
```

**AFTER: `e2e/webpack/webpack.config.js`**

```javascript
const path = require("path");

module.exports = {
  mode: "production",
  entry: "../fixtures/index.ts",  // Shared fixtures/
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    libraryTarget: "commonjs2",
  },
  module: {
    rules: [
      {
        test: /\.messages\.(ts|tsx)$/,
        include: path.resolve(__dirname, "../fixtures"),  // Shared fixtures/
        use: [
          {
            loader: "i18next-auto-keys",
            options: {
              include: /\.messages\.(ts|tsx)$/,
            },
          },
        ],
      },
    ],
  },
  // ...
};
```

**Changes:**
- ✏️ Entry: `./src/index.ts` → `../fixtures/index.ts`
- ✏️ Include path: `__dirname, "src"` → `__dirname, "../fixtures"`

### Rollup Config

**BEFORE: `e2e/rollup/rollup.config.js`**

```javascript
import typescript from "@rollup/plugin-typescript";
import { i18nextAutoKeyRollupPlugin } from "i18next-auto-keys";

export default {
  input: "src/index.ts",  // Local src/
  output: {
    dir: "dist",
    format: "cjs",
  },
  plugins: [
    i18nextAutoKeyRollupPlugin({
      include: [/\.messages\.(ts|tsx)$/],
      jsonOutputPath: "dist/locales/en.json",
    }),
    typescript(),
  ],
};
```

**AFTER: `e2e/rollup/rollup.config.js`**

```javascript
import typescript from "@rollup/plugin-typescript";
import { i18nextAutoKeyRollupPlugin } from "i18next-auto-keys";

export default {
  input: "../fixtures/index.ts",  // Shared fixtures/
  output: {
    dir: "dist",
    format: "cjs",
  },
  plugins: [
    i18nextAutoKeyRollupPlugin({
      include: [/\.messages\.(ts|tsx)$/],
      jsonOutputPath: "dist/locales/en.json",
    }),
    typescript(),
  ],
};
```

**Changes:**
- ✏️ Input: `src/index.ts` → `../fixtures/index.ts`

---

## Example 5: Package.json

### CLI Package (New!)

**NEW: `e2e/cli/package.json`**

```json
{
  "name": "i18next-auto-keys-cli-e2e",
  "version": "1.0.0",
  "private": true,
  "description": "CLI end-to-end tests for i18next-auto-keys",
  "scripts": {
    "test": "jest --runInBand",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "i18next": "^23.16.8",
    "i18next-auto-keys": "file:../.."
  },
  "devDependencies": {
    "@types/jest": "^29",
    "jest": "^29",
    "ts-jest": "^29.4.5",
    "typescript": "^5"
  }
}
```

**Why:** CLI tests are now independent and can run without webpack/rollup

### Root Package Scripts

**BEFORE: `package.json` (root)**

```json
{
  "scripts": {
    "test:e2e": "npm run build && npm run test:e2e:webpack && npm run test:e2e:rollup",
    "test:e2e:webpack": "cd e2e/webpack && npm install && npm test",
    "test:e2e:rollup": "cd e2e/rollup && npm install && npm test"
  }
}
```

**AFTER: `package.json` (root)**

```json
{
  "scripts": {
    "test:e2e": "npm run build && npm run test:e2e:cli && npm run test:e2e:bundlers",
    "test:e2e:cli": "cd e2e/cli && npm install && npm test",
    "test:e2e:bundlers": "npm run test:e2e:webpack && npm run test:e2e:rollup",
    "test:e2e:webpack": "cd e2e/webpack && npm install && npm test",
    "test:e2e:rollup": "cd e2e/rollup && npm install && npm test"
  }
}
```

**Changes:**
- ➕ New: `test:e2e:cli` command
- ➕ New: `test:e2e:bundlers` command
- ✏️ Modified: `test:e2e` now includes CLI tests

---

## Example 6: ICU Message Tests

### BEFORE: `e2e/rollup/tests/icu.e2e.test.ts`

```typescript
import { rollup } from "rollup";
import i18next from "i18next";
import ICU from "i18next-icu";

// Each bundler has its own ICU test fixtures
import { IcuMessages } from "../src/icu-index";

describe("Rollup ICU E2E Tests", () => {
  it("should handle ICU pluralization", async () => {
    const config = {
      input: "src/icu-index.ts",
      // ...
    };
    
    // Test pluralization
  });
});
```

### AFTER: `e2e/rollup/tests/icu.e2e.test.ts`

```typescript
import { rollup } from "rollup";
import i18next from "i18next";
import ICU from "i18next-icu";

// Now uses shared ICU fixtures (same as webpack)
import { IcuMessages } from "../../fixtures/icu-index";

describe("Rollup ICU E2E Tests", () => {
  it("should handle ICU pluralization", async () => {
    const config = {
      input: "../fixtures/icu-index.ts",
      // ...
    };
    
    // Test pluralization (unchanged)
  });
});
```

**Changes:**
- ✏️ Import: `../src/icu-index` → `../../fixtures/icu-index`
- ✏️ Config: `src/icu-index.ts` → `../fixtures/icu-index.ts`
- ✅ Both webpack and rollup now test the same ICU messages

---

## Example 7: TypeScript Config

### CLI TypeScript Config (New!)

**NEW: `e2e/cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "./dist",
    "types": ["jest", "node"]
  },
  "include": [
    "tests/**/*",
    "../fixtures/**/*"
  ],
  "exclude": ["node_modules", "dist"]
}
```

**Why:** CLI tests need to reference fixtures and have their own config

---

## Summary of Changes

| File Type | Before | After | Changes Required |
|-----------|--------|-------|------------------|
| **Test imports** | `../src/auth.messages` | `../../fixtures/messages/auth.messages` | Find & replace |
| **Build entry** | `./src/index.ts` | `../fixtures/index.ts` | Config update |
| **CLI tests** | `webpack/tests/cli.*.test.ts` | `cli/tests/cli.*.test.ts` | File move |
| **Source files** | `webpack/src/` + `rollup/src/` | `fixtures/` (single copy) | File move |
| **Package scripts** | 2 scripts | 5 scripts | Script addition |
| **Total files** | 24 files | 15 files | -37% reduction |

---

## Migration Verification Script

After migration, run this to verify everything:

```bash
#!/bin/bash

echo "🔍 Verifying E2E restructure..."

# Check fixtures exist
[ -d "e2e/fixtures/messages" ] && echo "✅ Fixtures directory exists" || echo "❌ Missing fixtures"

# Check old directories removed
[ ! -d "e2e/webpack/src" ] && echo "✅ Webpack src removed" || echo "❌ Webpack src still exists"
[ ! -d "e2e/rollup/src" ] && echo "✅ Rollup src removed" || echo "❌ Rollup src still exists"

# Check CLI tests exist
[ -f "e2e/cli/tests/cli.e2e.test.ts" ] && echo "✅ CLI tests exist" || echo "❌ Missing CLI tests"

# Run tests
echo ""
echo "🧪 Running tests..."
npm run test:e2e:cli && echo "✅ CLI tests pass" || echo "❌ CLI tests fail"
npm run test:e2e:webpack && echo "✅ Webpack tests pass" || echo "❌ Webpack tests fail"
npm run test:e2e:rollup && echo "✅ Rollup tests pass" || echo "❌ Rollup tests fail"

echo ""
echo "✨ Verification complete!"
```

---

## Conclusion

The restructuring primarily involves:

1. **Moving files**: Source files to shared fixtures
2. **Updating imports**: Adding one more `../` level
3. **Updating configs**: Pointing to fixtures instead of src
4. **Moving CLI tests**: From webpack to dedicated directory

**No test logic changes required** - only imports and paths!

