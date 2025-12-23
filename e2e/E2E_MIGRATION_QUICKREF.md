# E2E Restructuring - Quick Reference

## TL;DR

**Problem**: Test fixtures duplicated across webpack and rollup. CLI tests in wrong place.

**Solution**: 
- Shared `fixtures/` directory for all test source files
- Separate `cli/` directory for bundler-agnostic CLI tests  
- Bundler directories only contain bundler-specific integration tests

**Impact**: 24 → 15 files, zero duplication, clearer organization

---

## Directory Mapping

| Current Location | New Location | Reason |
|-----------------|--------------|--------|
| `webpack/src/*.messages.ts` | `fixtures/messages/*.messages.ts` | Shared fixtures |
| `rollup/src/*.messages.ts` | ❌ Deleted (duplicates) | Use shared fixtures |
| `webpack/src/index.ts` | `fixtures/index.ts` | Shared entry point |
| `webpack/src/icu-index.ts` | `fixtures/icu-index.ts` | Shared ICU entry |
| `rollup/src/index.ts` | ❌ Deleted (duplicate) | Use shared entry |
| `rollup/src/icu-index.ts` | ❌ Deleted (duplicate) | Use shared entry |
| `webpack/tests/cli.e2e.test.ts` | `cli/tests/cli.e2e.test.ts` | Bundler-agnostic |
| `webpack/tests/config.simple.e2e.test.ts` | `cli/tests/config.e2e.test.ts` | Bundler-agnostic |
| `webpack/tests/e2e.test.ts` | ✓ Stays (update imports) | Webpack-specific |
| `webpack/tests/icu.e2e.test.ts` | ✓ Stays (update imports) | Webpack-specific |
| `rollup/tests/e2e.test.ts` | ✓ Stays (update imports) | Rollup-specific |
| `rollup/tests/icu.e2e.test.ts` | ✓ Stays (update imports) | Rollup-specific |

---

## Import Changes Cheat Sheet

### Webpack Tests

```diff
- import { AuthMessages } from "../src/auth.messages";
+ import { AuthMessages } from "../../fixtures/messages/auth.messages";

- import { UiMessages } from "../src/ui.messages";
+ import { UiMessages } from "../../fixtures/messages/ui.messages";
```

### Rollup Tests

```diff
- import { AuthMessages } from "../src/auth.messages";
+ import { AuthMessages } from "../../fixtures/messages/auth.messages";

- import { UiMessages } from "../src/ui.messages";
+ import { UiMessages } from "../../fixtures/messages/ui.messages";
```

### CLI Tests (moved from webpack/tests/)

```diff
- import { AuthMessages } from "../src/auth.messages";
+ import { AuthMessages } from "../../fixtures/messages/auth.messages";
```

---

## Build Config Changes

### webpack.config.js

```diff
  export default {
-   entry: "./src/index.ts",
+   entry: "../fixtures/index.ts",
    output: {
      path: path.resolve(__dirname, "dist"),
      // ...
    }
  }
```

### rollup.config.js

```diff
  export default {
-   input: "src/index.ts",
+   input: "../fixtures/index.ts",
    output: {
      dir: "dist",
      // ...
    }
  }
```

---

## Package.json Script Updates

### Root package.json

```diff
  "scripts": {
-   "test:e2e": "npm run build && npm run test:e2e:webpack && npm run test:e2e:rollup",
+   "test:e2e": "npm run build && npm run test:e2e:cli && npm run test:e2e:bundlers",
+   "test:e2e:cli": "cd e2e/cli && npm install && npm test",
+   "test:e2e:bundlers": "npm run test:e2e:webpack && npm run test:e2e:rollup",
    "test:e2e:webpack": "cd e2e/webpack && npm install && npm test",
    "test:e2e:rollup": "cd e2e/rollup && npm install && npm test"
  }
```

---

## New Files to Create

### `e2e/fixtures/` Structure
```bash
mkdir -p e2e/fixtures/messages
# Move files from webpack/src/ to fixtures/
```

### `e2e/cli/` Structure
```bash
mkdir -p e2e/cli/tests
# Create package.json, jest.config.js, tsconfig.json
# Move CLI tests from webpack/tests/
```

### CLI package.json Template
```json
{
  "name": "i18next-auto-keys-cli-e2e",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "jest --runInBand"
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

---

## Migration Commands

```bash
# 1. Create fixtures directory
mkdir -p e2e/fixtures/messages

# 2. Move shared source files
mv e2e/webpack/src/*.messages.ts e2e/fixtures/messages/
mv e2e/webpack/src/index.ts e2e/fixtures/
mv e2e/webpack/src/icu-index.ts e2e/fixtures/

# 3. Remove duplicate rollup sources
rm -rf e2e/rollup/src

# 4. Create CLI test directory
mkdir -p e2e/cli/tests

# 5. Move CLI tests
mv e2e/webpack/tests/cli.e2e.test.ts e2e/cli/tests/
mv e2e/webpack/tests/config.simple.e2e.test.ts e2e/cli/tests/config.e2e.test.ts

# 6. Create CLI package files
# (manually create package.json, jest.config.js, tsconfig.json)

# 7. Update imports in all test files
# (use find-and-replace or sed)

# 8. Update build configs
# (edit webpack.config.js and rollup.config.js)

# 9. Test everything
npm run test:e2e
```

---

## Validation Checklist

After migration, verify:

- [ ] `e2e/fixtures/messages/` contains 7 message files
- [ ] `e2e/fixtures/` contains `index.ts` and `icu-index.ts`
- [ ] `e2e/webpack/src/` directory is deleted
- [ ] `e2e/rollup/src/` directory is deleted
- [ ] `e2e/cli/tests/` contains 2 test files
- [ ] `e2e/cli/package.json` exists and has correct dependencies
- [ ] All imports updated to use `../../fixtures/`
- [ ] Webpack configs point to `../fixtures/`
- [ ] Rollup configs point to `../fixtures/`
- [ ] `npm run test:e2e:cli` passes
- [ ] `npm run test:e2e:webpack` passes
- [ ] `npm run test:e2e:rollup` passes
- [ ] `npm run test:e2e` passes
- [ ] No TypeScript errors in IDE
- [ ] Git status shows expected file moves/deletions

---

## Common Issues & Fixes

### Issue: Module not found

**Error:**
```
Cannot find module '../../fixtures/messages/auth.messages'
```

**Fix:**
- Check that path is correct (count ../ levels)
- Verify fixtures directory was created
- Ensure files were moved, not copied

### Issue: Webpack can't resolve entry

**Error:**
```
Module not found: Error: Can't resolve '../fixtures/index.ts'
```

**Fix:**
- Check webpack.config.js entry path
- Should be `../fixtures/index.ts` not `./src/index.ts`
- Verify path relative to webpack/ directory

### Issue: Tests fail to import i18next-auto-keys

**Error:**
```
Cannot find package 'i18next-auto-keys'
```

**Fix:**
- Run `npm install` in the test directory
- For CLI tests: `cd e2e/cli && npm install`
- Ensure `package.json` has correct dependency path

### Issue: Jest can't find config

**Error:**
```
No tests found
```

**Fix:**
- Ensure `jest.config.js` exists in test directory
- Check testMatch patterns in jest config
- Verify test files have `.test.ts` or `.e2e.test.ts` extension

---

## Rollback Instructions

If you need to revert:

```bash
# Using git (recommended)
git checkout HEAD -- e2e/

# Or manual rollback
# 1. Restore webpack/src/ from backup
# 2. Restore rollup/src/ from backup  
# 3. Move CLI tests back to webpack/tests/
# 4. Revert import changes
# 5. Revert config changes
# 6. Delete fixtures/ and cli/ directories
```

---

## Timeline Estimate

- **Phase 1** (Fixtures): 30 minutes
- **Phase 2** (CLI tests): 30 minutes
- **Phase 3** (Webpack updates): 20 minutes
- **Phase 4** (Rollup updates): 20 minutes
- **Phase 5** (Scripts): 15 minutes
- **Phase 6** (Documentation): 15 minutes
- **Testing & Fixes**: 30 minutes

**Total**: ~2.5-3 hours

---

## Questions?

See full proposal: `E2E_RESTRUCTURE_PROPOSAL.md`
See visual guide: `E2E_STRUCTURE_VISUAL.md`

