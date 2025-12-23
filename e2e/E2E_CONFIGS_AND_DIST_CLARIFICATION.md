# E2E Configs and Build Outputs - Clarification

## Questions Addressed

1. **What is in the `e2e/configs` folder?**
2. **Are these configs for the build tests?**
3. **Will the dist folder be unique for each bundler?**

---

## 1. What's in `e2e/configs`?

The `configs/` folder contains the **build configurations** for each bundler. These tell the bundlers how to:
- Transform the fixture files using i18next-auto-keys
- Generate translation JSON files
- Output bundled JavaScript

### Structure

```
e2e/configs/
├── webpack/
│   ├── webpack.config.js       ← Webpack build configuration
│   └── webpack-configs.ts      ← Helper to create different webpack configs
│
└── rollup/
    ├── rollup.config.js        ← Rollup build configuration
    └── rollup-configs.ts       ← Helper to create different rollup configs
```

### Example: webpack.config.js

```javascript
const path = require("path");
const { I18nextAutoKeyEmitPlugin } = require("i18next-auto-keys");

module.exports = {
  mode: "production",
  
  // Input: shared fixtures
  entry: path.resolve(__dirname, "../../fixtures/index.ts"),
  
  // Output: webpack-specific dist
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
  
  plugins: [
    new I18nextAutoKeyEmitPlugin({
      jsonOutputPath: path.resolve(__dirname, "../../dist/webpack/locales/en.json"),
    }),
  ],
  
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
};
```

### Example: rollup.config.js

```javascript
const path = require("path");
const typescript = require("@rollup/plugin-typescript");
const { i18nextAutoKeyRollupPlugin } = require("i18next-auto-keys");

module.exports = {
  // Input: shared fixtures
  input: path.resolve(__dirname, "../../fixtures/index.ts"),
  
  // Output: rollup-specific dist
  output: {
    dir: path.resolve(__dirname, "../../dist/rollup"),
    format: "cjs",
    sourcemap: true,
  },
  
  plugins: [
    i18nextAutoKeyRollupPlugin({
      include: [/\.messages\.(ts|tsx)$/],
      jsonOutputPath: path.resolve(__dirname, "../../dist/rollup/locales/en.json"),
    }),
    typescript({
      tsconfig: path.resolve(__dirname, "../../tsconfig.json"),
    }),
  ],
};
```

---

## 2. Are these configs for the build tests?

**Yes!** These configs serve two purposes:

### Purpose A: Building Test Bundles

Before running tests, we need to **build** the fixtures with each bundler:

```bash
# In e2e/package.json
"build:webpack": "webpack --config configs/webpack/webpack.config.js",
"build:rollup": "rollup --config configs/rollup/rollup.config.js",
"build:all": "npm-run-all --parallel build:webpack build:rollup"
```

This transforms:
```
fixtures/messages/auth.messages.ts  →  dist/webpack/bundle.js
                                    →  dist/webpack/locales/en.json
                                    
                                    →  dist/rollup/bundle.js
                                    →  dist/rollup/locales/en.json
```

### Purpose B: Used by Tests

The tests import these configs to create **dynamic test builds**:

```typescript
// tests/webpack/e2e.test.ts
import { createWebpackConfig } from "../../configs/webpack/webpack-configs";

describe("Webpack E2E Tests", () => {
  it("should transform with custom config", async () => {
    // Create a custom config for this specific test
    const config = createWebpackConfig({
      configName: "long-hashes",
      hashLength: 16,
      entry: path.resolve(__dirname, "../../fixtures/index.ts"),
      output: path.resolve(__dirname, "../../dist/webpack/bundle-long-hashes.js"),
    });
    
    // Build with this config
    await webpack(config);
    
    // Test the output
    const bundle = fs.readFileSync(config.output.path);
    expect(bundle).toContain("someExpectedHash");
  });
});
```

So the configs are:
- ✅ Used to build the default bundles
- ✅ Used as templates to create test-specific configs
- ✅ Helper functions to reduce duplication

---

## 3. Will dist be unique for each bundler?

**Yes, absolutely!** Each bundler gets its own output directory to avoid conflicts.

### Dist Structure

```
e2e/dist/
├── webpack/                    ← Webpack outputs only
│   ├── bundle.js
│   ├── bundle.js.map
│   ├── bundle-long-hashes.js
│   ├── bundle-short-hashes.js
│   ├── bundle-icu.js
│   └── locales/
│       └── en.json             ← Webpack's translations
│
├── rollup/                     ← Rollup outputs only
│   ├── bundle.js
│   ├── bundle.js.map
│   ├── bundle-long-hashes.js
│   ├── bundle-short-hashes.js
│   ├── bundle-icu.js
│   └── locales/
│       └── en.json             ← Rollup's translations
│
└── cli/                        ← CLI test outputs (optional)
    └── temp-test-files/
```

### Why Separate?

**Different bundlers produce different outputs:**

1. **Different bundle formats**
   - Webpack: CommonJS with webpack runtime
   - Rollup: Clean ESM or CJS
   
2. **Different transformation results**
   - Tests verify bundler-specific behavior
   - Need to compare webpack output vs rollup output
   
3. **Parallel builds**
   - Can build webpack and rollup simultaneously
   - No file conflicts
   
4. **Isolated testing**
   - Each test suite works with its own dist
   - No cross-contamination

### Config Paths

**Webpack config:**
```javascript
{
  output: {
    path: path.resolve(__dirname, "../../dist/webpack"),  // ← Webpack dir
    filename: "bundle.js",
  },
  plugins: [
    new I18nextAutoKeyEmitPlugin({
      jsonOutputPath: path.resolve(__dirname, "../../dist/webpack/locales/en.json"),
    }),
  ],
}
```

**Rollup config:**
```javascript
{
  output: {
    dir: path.resolve(__dirname, "../../dist/rollup"),  // ← Rollup dir
    format: "cjs",
  },
  plugins: [
    i18nextAutoKeyRollupPlugin({
      jsonOutputPath: path.resolve(__dirname, "../../dist/rollup/locales/en.json"),
    }),
  ],
}
```

---

## Complete Flow

### 1. Developer runs tests

```bash
cd e2e
npm test
```

### 2. package.json executes

```json
{
  "scripts": {
    "test": "npm run build:all && npm run test:run"
  }
}
```

### 3. Build phase (parallel)

```bash
# Runs simultaneously:
webpack --config configs/webpack/webpack.config.js
rollup --config configs/rollup/rollup.config.js
```

**Produces:**
- `dist/webpack/bundle.js` + `dist/webpack/locales/en.json`
- `dist/rollup/bundle.js` + `dist/rollup/locales/en.json`

### 4. Test phase

```bash
jest --testPathPattern=tests/cli      # CLI tests
jest --testPathPattern=tests/webpack  # Webpack tests
jest --testPathPattern=tests/rollup   # Rollup tests
```

**Tests verify:**
- ✅ Bundle was created
- ✅ Translations were extracted
- ✅ Source transformations are correct
- ✅ Runtime behavior works

### 5. Tests read from dist

```typescript
// tests/webpack/e2e.test.ts
it("should generate correct translations", () => {
  const translations = fs.readFileSync(
    path.resolve(__dirname, "../../dist/webpack/locales/en.json"),
    "utf-8"
  );
  
  const parsed = JSON.parse(translations);
  expect(parsed).toHaveProperty("someHashKey", "Welcome back, {{name}}!");
});

it("should bundle correctly", () => {
  const bundle = require("../../dist/webpack/bundle.js");
  expect(bundle.AuthMessages.title()).toBe("t:someHashKey");
});
```

---

## Directory Organization

### Current (Before Restructuring)

```
e2e/
├── webpack/
│   ├── webpack.config.js       ← Config
│   ├── src/                    ← Fixtures (duplicate!)
│   └── dist/                   ← Webpack outputs
│       └── bundle.js
│
└── rollup/
    ├── rollup.config.js        ← Config
    ├── src/                    ← Fixtures (duplicate!)
    └── dist/                   ← Rollup outputs
        └── bundle.js
```

### Proposed (Single package.json)

```
e2e/
├── package.json                ← Single package
├── fixtures/                   ← Shared fixtures (single source!)
│   └── messages/
├── configs/                    ← Build configs
│   ├── webpack/
│   │   └── webpack.config.js
│   └── rollup/
│       └── rollup.config.js
├── tests/                      ← Test files
│   ├── webpack/
│   │   └── e2e.test.ts
│   └── rollup/
│       └── e2e.test.ts
└── dist/                       ← Build outputs (separate per bundler)
    ├── webpack/
    │   ├── bundle.js
    │   └── locales/en.json
    └── rollup/
        ├── bundle.js
        └── locales/en.json
```

**Key points:**
- ✅ **Fixtures**: Shared (single source)
- ✅ **Configs**: Separate per bundler (in configs/)
- ✅ **Tests**: Separate per bundler (in tests/)
- ✅ **Dist**: Separate per bundler (in dist/webpack, dist/rollup)

---

## Alternative: Shared Translation Output?

**Question:** Could webpack and rollup share the translation JSON output?

```
dist/
├── locales/
│   └── en.json        ← Shared by both?
├── webpack/
│   └── bundle.js
└── rollup/
    └── bundle.js
```

**Answer:** Not recommended!

**Why separate is better:**

1. **Tests verify translation extraction per bundler**
   - Each bundler might extract differently
   - Tests need to verify bundler-specific behavior

2. **Parallel builds**
   - Both bundlers writing to same file = race condition
   - Separate paths = safe parallelism

3. **Test isolation**
   - Webpack test shouldn't be affected by rollup build
   - Clear which bundler produced which output

4. **Different test scenarios**
   - Webpack tests might use different hash lengths
   - Rollup tests might use different options
   - Each needs its own translation file

**Exception:** You could have a shared location for the **final** merged translations after all builds complete, but during testing, keep them separate.

---

## Summary

### `e2e/configs/` contains:
- ✅ **Build configurations** for each bundler
- ✅ **Helper functions** to create test-specific configs
- ✅ Used by both npm scripts and test files

### `e2e/dist/` structure:
- ✅ **Separate directory per bundler** (`dist/webpack/`, `dist/rollup/`)
- ✅ **No shared paths** between bundlers
- ✅ Each bundler builds to its own output
- ✅ Prevents conflicts and enables parallel builds

### Flow:
```
fixtures/           →  configs/           →  dist/
(shared)               (per bundler)         (per bundler)

auth.messages.ts  →  webpack.config.js  →  dist/webpack/
ui.messages.ts    →                        - bundle.js
index.ts          →  rollup.config.js   →  - locales/en.json
                                         
                                         →  dist/rollup/
                                            - bundle.js
                                            - locales/en.json
```

---

**In short:**
- `configs/` = How to build (per bundler)
- `fixtures/` = What to build (shared)
- `dist/` = Build output (separate per bundler)

Does this clarify things? Let me know if you have more questions!

