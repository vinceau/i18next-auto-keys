# E2E Restructuring - Single package.json Approach

## Alternative Proposal: Centralized E2E Package Management

This document presents an **improved approach** using a single `e2e/package.json` to manage all bundler tests, making the structure even simpler and the root package.json bundler-agnostic.

---

## Core Idea

Instead of separate package.json files in each directory:
- ✅ Single `e2e/package.json` with all dependencies and scripts
- ✅ Root package.json just calls `npm test` in e2e folder
- ✅ Run bundler tests concurrently for speed
- ✅ Root doesn't need to know which bundlers exist

---

## Proposed Structure

```
e2e/
├── package.json               ← SINGLE package.json for all tests
├── jest.config.js             ← Shared Jest config
├── tsconfig.json              ← Shared TypeScript config
├── node_modules/              ← Shared dependencies
│
├── fixtures/                  ← Shared test source files
│   ├── messages/
│   │   └── *.messages.ts
│   ├── index.ts
│   └── icu-index.ts
│
├── tests/                     ← All tests in one place
│   ├── cli/
│   │   ├── cli.e2e.test.ts
│   │   └── config.e2e.test.ts
│   ├── webpack/
│   │   ├── e2e.test.ts
│   │   └── icu.e2e.test.ts
│   └── rollup/
│       ├── e2e.test.ts
│       └── icu.e2e.test.ts
│
├── configs/                   ← Build configurations
│   ├── webpack/
│   │   ├── webpack-configs.ts
│   │   └── webpack.config.js
│   └── rollup/
│       ├── rollup-configs.ts
│       └── rollup.config.js
│
└── dist/                      ← Shared build outputs
    ├── webpack/
    ├── rollup/
    └── locales/
```

---

## E2E package.json

```json
{
  "name": "i18next-auto-keys-e2e",
  "version": "1.0.0",
  "private": true,
  "description": "End-to-end tests for i18next-auto-keys",
  
  "scripts": {
    "test": "npm run test:all",
    "test:all": "npm run build:all && npm run test:run",
    
    "build:all": "npm-run-all --parallel build:webpack build:rollup",
    "build:webpack": "webpack --config configs/webpack/webpack.config.js",
    "build:rollup": "rollup --config configs/rollup/rollup.config.js",
    
    "test:run": "npm-run-all test:cli test:bundlers",
    "test:cli": "jest --testPathPattern=tests/cli",
    "test:bundlers": "npm-run-all --parallel test:webpack test:rollup",
    "test:webpack": "jest --testPathPattern=tests/webpack",
    "test:rollup": "jest --testPathPattern=tests/rollup",
    
    "test:watch": "jest --watch",
    "clean": "rimraf dist"
  },
  
  "dependencies": {
    "i18next": "^23.16.8",
    "i18next-auto-keys": "file:..",
    "i18next-icu": "^2.4.1"
  },
  
  "devDependencies": {
    "@types/jest": "^29",
    "@types/webpack": "^5",
    "jest": "^29",
    "npm-run-all": "^4.1.5",
    "rimraf": "^6.0.1",
    "ts-jest": "^29.4.5",
    "typescript": "^5",
    
    "webpack": "^5",
    "webpack-cli": "^6.0.1",
    "ts-loader": "^9.5.4",
    
    "rollup": "^4.28.1",
    "@rollup/plugin-typescript": "^12.1.1",
    "@rollup/plugin-node-resolve": "^15.3.0",
    "@rollup/plugin-commonjs": "^28.0.2",
    "@rollup/plugin-alias": "^5.1.1",
    "tslib": "^2.8.1"
  }
}
```

---

## Root package.json

**BEFORE:**
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

**AFTER (Simplified!):**
```json
{
  "scripts": {
    "test:e2e": "npm run build && cd e2e && npm install && npm test"
  }
}
```

**Benefits:**
- ✅ Root doesn't need to know about webpack, rollup, or future bundlers
- ✅ Adding Vite? Just update `e2e/package.json`, not root
- ✅ Single command to run all e2e tests
- ✅ Much simpler

---

## Jest Config (Shared)

**e2e/jest.config.js:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // All tests in tests/ directory
  testMatch: ['**/tests/**/*.test.ts'],
  
  // Test timeout for e2e tests
  testTimeout: 30000,
  
  // Module paths
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Coverage
  collectCoverageFrom: [
    'tests/**/*.ts',
    '!tests/**/*.d.ts',
  ],
  
  // Separate coverage for different test types
  coverageDirectory: 'coverage',
  
  // Run tests serially (builds can interfere)
  maxWorkers: 1,
};
```

---

## TypeScript Config (Shared)

**e2e/tsconfig.json:**
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "./dist",
    "types": ["jest", "node"],
    "moduleResolution": "node",
    "esModuleInterop": true
  },
  "include": [
    "fixtures/**/*",
    "tests/**/*",
    "configs/**/*"
  ],
  "exclude": ["node_modules", "dist"]
}
```

---

## Test File Updates

### CLI Test (tests/cli/cli.e2e.test.ts)

```typescript
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

describe("CLI E2E Tests", () => {
  // CLI path relative to e2e directory
  const cliPath = path.resolve(__dirname, "../../dist/cli.js");
  const testDir = path.join(__dirname, "temp-cli-tests");
  
  // Tests unchanged...
});
```

### Webpack Test (tests/webpack/e2e.test.ts)

```typescript
import webpack from "webpack";
import path from "path";

// Import from shared fixtures
import { AuthMessages } from "../../fixtures/messages/auth.messages";
import { UiMessages } from "../../fixtures/messages/ui.messages";

// Import webpack config helper
import { createWebpackConfig } from "../../configs/webpack/webpack-configs";

describe("Webpack E2E Tests", () => {
  it("should transform messages", async () => {
    const config = createWebpackConfig({
      entry: path.resolve(__dirname, "../../fixtures/index.ts"),
      output: path.resolve(__dirname, "../../dist/webpack/bundle.js"),
    });
    
    // Tests unchanged...
  });
});
```

### Rollup Test (tests/rollup/e2e.test.ts)

```typescript
import { rollup } from "rollup";
import path from "path";

// Import from shared fixtures
import { AuthMessages } from "../../fixtures/messages/auth.messages";
import { UiMessages } from "../../fixtures/messages/ui.messages";

// Import rollup config helper
import { createRollupConfig } from "../../configs/rollup/rollup-configs";

describe("Rollup E2E Tests", () => {
  it("should transform messages", async () => {
    const config = createRollupConfig({
      input: path.resolve(__dirname, "../../fixtures/index.ts"),
      output: {
        dir: path.resolve(__dirname, "../../dist/rollup"),
      },
    });
    
    // Tests unchanged...
  });
});
```

---

## Webpack Config

**e2e/configs/webpack/webpack.config.js:**
```javascript
const path = require("path");

module.exports = {
  mode: "production",
  entry: path.resolve(__dirname, "../../fixtures/index.ts"),
  output: {
    path: path.resolve(__dirname, "../../dist/webpack"),
    filename: "bundle.js",
    libraryTarget: "commonjs2",
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.messages\.(ts|tsx)$/,
        include: path.resolve(__dirname, "../../fixtures"),
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
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  plugins: [
    new (require("i18next-auto-keys").I18nextAutoKeyEmitPlugin)({
      jsonOutputPath: path.resolve(__dirname, "../../dist/locales/en.json"),
    }),
  ],
};
```

---

## Rollup Config

**e2e/configs/rollup/rollup.config.js:**
```javascript
const path = require("path");
const typescript = require("@rollup/plugin-typescript");
const { i18nextAutoKeyRollupPlugin } = require("i18next-auto-keys");

module.exports = {
  input: path.resolve(__dirname, "../../fixtures/index.ts"),
  output: {
    dir: path.resolve(__dirname, "../../dist/rollup"),
    format: "cjs",
  },
  plugins: [
    i18nextAutoKeyRollupPlugin({
      include: [/\.messages\.(ts|tsx)$/],
      jsonOutputPath: path.resolve(__dirname, "../../dist/locales/en.json"),
    }),
    typescript({
      tsconfig: path.resolve(__dirname, "../../tsconfig.json"),
    }),
  ],
};
```

---

## Comparison: Original vs Alternative

### Original Proposal (Multiple package.json)

```
e2e/
├── cli/
│   ├── package.json          ← Separate
│   ├── jest.config.js
│   └── tests/
├── webpack/
│   ├── package.json          ← Separate
│   ├── jest.config.js
│   └── tests/
└── rollup/
    ├── package.json          ← Separate
    ├── jest.config.js
    └── tests/
```

**Pros:**
- Isolated dependencies per bundler
- Can run bundler tests independently

**Cons:**
- 3 separate `npm install` commands
- 3 separate node_modules directories
- 3 separate package.json to maintain
- Root package.json needs to know about each bundler

---

### Alternative Proposal (Single package.json) ✨

```
e2e/
├── package.json              ← SINGLE
├── jest.config.js            ← SINGLE
├── tsconfig.json             ← SINGLE
├── node_modules/             ← SINGLE
├── fixtures/
├── tests/
│   ├── cli/
│   ├── webpack/
│   └── rollup/
└── configs/
    ├── webpack/
    └── rollup/
```

**Pros:**
- ✅ Single `npm install` for all e2e tests
- ✅ Single package.json to maintain
- ✅ Shared node_modules (disk space savings)
- ✅ Root package.json bundler-agnostic
- ✅ Easy to add new bundlers
- ✅ Can run tests in parallel easily
- ✅ Simpler overall structure

**Cons:**
- All bundler dependencies in one package.json
- Can't isolate bundler dependencies (usually not needed)

---

## Migration Impact

### Files to Create
```
e2e/
├── package.json (NEW - single shared)
├── jest.config.js (NEW - shared)
├── tsconfig.json (NEW - shared)
├── fixtures/ (NEW - shared fixtures)
├── tests/ (NEW - organized by type)
│   ├── cli/
│   ├── webpack/
│   └── rollup/
└── configs/ (NEW - build configs)
    ├── webpack/
    └── rollup/
```

### Files to Delete
```
e2e/
├── webpack/
│   ├── package.json (DELETE)
│   ├── jest.config.js (DELETE)
│   ├── tsconfig.json (DELETE)
│   ├── src/ (DELETE - move to fixtures)
│   └── node_modules/ (DELETE)
└── rollup/
    ├── package.json (DELETE)
    ├── jest.config.js (DELETE)
    ├── tsconfig.json (DELETE)
    ├── src/ (DELETE - move to fixtures)
    └── node_modules/ (DELETE)
```

### Import Path Changes

**CLI Tests:**
```diff
- import { AuthMessages } from "../../fixtures/messages/auth.messages";
+ import { AuthMessages } from "../../fixtures/messages/auth.messages";
```
*(Same - still two levels up)*

**Webpack Tests:**
```diff
- import { AuthMessages } from "../src/auth.messages";
+ import { AuthMessages } from "../../fixtures/messages/auth.messages";
```

**Rollup Tests:**
```diff
- import { AuthMessages } from "../src/auth.messages";
+ import { AuthMessages } from "../../fixtures/messages/auth.messages";
```

---

## Running Tests

### Development

```bash
# Install all dependencies
cd e2e && npm install

# Run all tests
npm test

# Run specific test suites
npm run test:cli
npm run test:webpack
npm run test:rollup
npm run test:bundlers

# Build only (no tests)
npm run build:all
npm run build:webpack
npm run build:rollup

# Watch mode
npm run test:watch

# Clean build artifacts
npm run clean
```

### CI/CD

```bash
# In GitHub Actions or similar
- name: Run E2E Tests
  run: |
    npm run build
    cd e2e
    npm install
    npm test
```

Or in root package.json:
```bash
npm run test:e2e
```

---

## Adding a New Bundler (e.g., Vite)

### Step 1: Add Scripts to e2e/package.json

```diff
  "scripts": {
-   "build:all": "npm-run-all --parallel build:webpack build:rollup",
+   "build:all": "npm-run-all --parallel build:webpack build:rollup build:vite",
+   "build:vite": "vite build --config configs/vite/vite.config.js",
    
-   "test:bundlers": "npm-run-all --parallel test:webpack test:rollup",
+   "test:bundlers": "npm-run-all --parallel test:webpack test:rollup test:vite",
+   "test:vite": "jest --testPathPattern=tests/vite",
  }
```

### Step 2: Add Vite Dependencies

```diff
  "devDependencies": {
+   "vite": "^6.0.0",
  }
```

### Step 3: Create Test Files

```bash
mkdir -p e2e/tests/vite
# Create e2e/tests/vite/e2e.test.ts
```

### Step 4: Create Config

```bash
mkdir -p e2e/configs/vite
# Create e2e/configs/vite/vite.config.js
```

**That's it!** Root package.json doesn't change at all.

---

## Benefits Summary

### ✅ Simplified Root Package.json

**Before (Original Proposal):**
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

**After (Single package.json):**
```json
{
  "scripts": {
    "test:e2e": "npm run build && cd e2e && npm install && npm test"
  }
}
```

**Reduction**: 5 scripts → 1 script ✨

### ✅ Single npm install

**Before:**
```bash
cd e2e/cli && npm install
cd ../webpack && npm install
cd ../rollup && npm install
```

**After:**
```bash
cd e2e && npm install
```

### ✅ Bundler-Agnostic Root

- Root package.json doesn't mention webpack, rollup, vite, etc.
- Adding/removing bundlers doesn't affect root
- Clean separation of concerns

### ✅ Parallel Test Execution

```bash
# Run all bundler tests concurrently
npm run test:bundlers
# Uses npm-run-all --parallel
```

### ✅ Shared Dependencies

- Single node_modules for all e2e tests
- Disk space savings
- Faster npm install
- Consistent versions across all tests

---

## Metrics Comparison

| Metric | Before | Original Proposal | Alternative | Best |
|--------|--------|-------------------|-------------|------|
| **package.json files** | 2 | 4 (cli, webpack, rollup, root) | 2 (e2e, root) | ✅ Alternative |
| **npm install commands** | 2 | 3 | 1 | ✅ Alternative |
| **node_modules dirs** | 2 | 3 | 1 | ✅ Alternative |
| **Root script complexity** | Medium | High | Low | ✅ Alternative |
| **Duplicate fixtures** | 9 files | 0 | 0 | ✅ Both |
| **Misplaced tests** | 2 | 0 | 0 | ✅ Both |
| **Adding new bundler** | Complex | Medium | Easy | ✅ Alternative |

---

## Recommendation

**✅ Use the Single package.json Approach**

**Why:**
1. **Simpler** - Fewer package.json files to maintain
2. **Faster** - Single npm install, parallel test execution
3. **Cleaner** - Root package.json is bundler-agnostic
4. **Scalable** - Easy to add new bundlers
5. **Efficient** - Shared dependencies and disk space

**When this is ideal:**
- ✅ E2E tests are all related (testing same tool)
- ✅ Can run tests on same machine/CI
- ✅ Want simple root-level commands
- ✅ Plan to add more bundlers

**When to use multiple package.json:**
- Tests run in completely separate environments
- Need strict dependency isolation
- Extremely large test suites with conflicting deps

For this project, **single package.json is the better choice**.

---

## Updated Implementation Checklist

See [E2E_IMPLEMENTATION_CHECKLIST_V2.md](./E2E_IMPLEMENTATION_CHECKLIST_V2.md) for detailed steps with the single package.json approach.

---

## Next Steps

1. Review this alternative approach
2. Compare with original proposal
3. Choose approach (recommendation: single package.json)
4. Follow updated implementation checklist
5. Migrate and test

---

**Status**: Alternative Proposal - Single package.json Approach
**Recommended**: ✅ Yes - Simpler and more maintainable
**Impact**: Even better than original proposal

