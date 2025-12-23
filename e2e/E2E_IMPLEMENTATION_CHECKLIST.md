# E2E Restructuring - Implementation Checklist

This checklist provides step-by-step instructions for implementing the e2e test restructuring.

---

## Pre-Migration

### ☐ 1. Backup Current State
```bash
# Create a backup branch
git checkout -b backup/e2e-pre-restructure
git push origin backup/e2e-pre-restructure

# Return to main branch
git checkout main
```

### ☐ 2. Create Feature Branch
```bash
git checkout -b refactor/e2e-restructure
```

### ☐ 3. Ensure All Tests Pass
```bash
# Build the project
npm run build

# Run all e2e tests
npm run test:e2e:webpack
npm run test:e2e:rollup

# Confirm all pass ✅
```

### ☐ 4. Document Current State
```bash
# Count files for later comparison
find e2e -type f -name "*.ts" -o -name "*.js" | wc -l

# Save current structure
tree e2e > /tmp/e2e-before.txt
```

---

## Phase 1: Create Shared Fixtures Directory

### ☐ 1.1. Create Directory Structure
```bash
mkdir -p e2e/fixtures/messages
```

### ☐ 1.2. Move Message Files
```bash
# Move all message files
mv e2e/webpack/src/auth.messages.ts e2e/fixtures/messages/
mv e2e/webpack/src/auth-indexed.messages.ts e2e/fixtures/messages/
mv e2e/webpack/src/ui.messages.ts e2e/fixtures/messages/
mv e2e/webpack/src/ui-indexed.messages.ts e2e/fixtures/messages/
mv e2e/webpack/src/context.messages.ts e2e/fixtures/messages/
mv e2e/webpack/src/replay-browser.messages.ts e2e/fixtures/messages/
mv e2e/webpack/src/replay-browser-indexed.messages.ts e2e/fixtures/messages/
```

### ☐ 1.3. Move Entry Point Files
```bash
mv e2e/webpack/src/index.ts e2e/fixtures/
mv e2e/webpack/src/icu-index.ts e2e/fixtures/
```

### ☐ 1.4. Delete Duplicate rollup/src/
```bash
rm -rf e2e/rollup/src
```

### ☐ 1.5. Delete Empty webpack/src/
```bash
rmdir e2e/webpack/src
```

### ☐ 1.6. Verify Structure
```bash
# Should show 9 files
ls -la e2e/fixtures/
ls -la e2e/fixtures/messages/

# Should be gone
[ ! -d e2e/webpack/src ] && echo "✅ webpack/src deleted"
[ ! -d e2e/rollup/src ] && echo "✅ rollup/src deleted"
```

### ☐ 1.7. Commit Phase 1
```bash
git add e2e/fixtures/
git add e2e/webpack/
git add e2e/rollup/
git commit -m "refactor(e2e): create shared fixtures directory

- Move message files from webpack/src to fixtures/messages
- Move entry points to fixtures/
- Delete duplicate rollup/src directory
- Delete empty webpack/src directory"
```

---

## Phase 2: Extract CLI Tests

### ☐ 2.1. Create CLI Directory Structure
```bash
mkdir -p e2e/cli/tests
```

### ☐ 2.2. Move CLI Tests
```bash
mv e2e/webpack/tests/cli.e2e.test.ts e2e/cli/tests/
mv e2e/webpack/tests/config.simple.e2e.test.ts e2e/cli/tests/config.e2e.test.ts
```

### ☐ 2.3. Create CLI package.json
```bash
cat > e2e/cli/package.json << 'EOF'
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
EOF
```

### ☐ 2.4. Create CLI jest.config.js
```bash
cat > e2e/cli/jest.config.js << 'EOF'
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: ['tests/**/*.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testTimeout: 30000,
};
EOF
```

### ☐ 2.5. Create CLI tsconfig.json
```bash
cat > e2e/cli/tsconfig.json << 'EOF'
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
EOF
```

### ☐ 2.6. Create CLI README.md
```bash
cat > e2e/cli/README.md << 'EOF'
# CLI End-to-End Tests

This directory contains end-to-end tests for the i18next-auto-keys CLI.

## Running Tests

```bash
npm test
```

## What's Tested

- CLI command execution (extract, sync, status, convert)
- Configuration file loading
- Error handling
- Output validation

These tests are bundler-agnostic and test the CLI functionality independently.
EOF
```

### ☐ 2.7. Commit Phase 2
```bash
git add e2e/cli/
git add e2e/webpack/tests/
git commit -m "refactor(e2e): extract CLI tests to separate directory

- Move cli.e2e.test.ts to cli/tests/
- Rename and move config.simple.e2e.test.ts to cli/tests/config.e2e.test.ts
- Create cli/package.json with minimal dependencies
- Create cli/jest.config.js
- Create cli/tsconfig.json
- Add CLI README"
```

---

## Phase 3: Update Webpack Tests

### ☐ 3.1. Update Webpack Test Imports

Edit `e2e/webpack/tests/e2e.test.ts`:
```bash
# Find and replace imports
# ../src/ → ../../fixtures/messages/
```

Manually update these lines:
```diff
- import { AuthMessages } from "../src/auth.messages";
+ import { AuthMessages } from "../../fixtures/messages/auth.messages";

- import { AuthMessagesIndexed } from "../src/auth-indexed.messages";
+ import { AuthMessagesIndexed } from "../../fixtures/messages/auth-indexed.messages";

- import { UiMessages } from "../src/ui.messages";
+ import { UiMessages } from "../../fixtures/messages/ui.messages";

- import { UiMessagesIndexed } from "../src/ui-indexed.messages";
+ import { UiMessagesIndexed } from "../../fixtures/messages/ui-indexed.messages";

- import { ContextMessages } from "../src/context.messages";
+ import { ContextMessages } from "../../fixtures/messages/context.messages";

- import { ReplayBrowserMessages } from "../src/replay-browser.messages";
+ import { ReplayBrowserMessages } from "../../fixtures/messages/replay-browser.messages";

- import { ReplayBrowserMessagesIndexed } from "../src/replay-browser-indexed.messages";
+ import { ReplayBrowserMessagesIndexed } from "../../fixtures/messages/replay-browser-indexed.messages";
```

### ☐ 3.2. Update Webpack ICU Test Imports

Edit `e2e/webpack/tests/icu.e2e.test.ts`:
```diff
- import { IcuMessages } from "../src/icu-index";
+ import { IcuMessages } from "../../fixtures/icu-index";
```

### ☐ 3.3. Update webpack-configs.ts

Edit `e2e/webpack/webpack-configs.ts`:
```diff
  function createWebpackConfig(options) {
    return {
-     entry: `./src/${options.entry || 'index.ts'}`,
+     entry: `../fixtures/${options.entry || 'index.ts'}`,
      
      module: {
        rules: [{
-         include: path.resolve(__dirname, "src"),
+         include: path.resolve(__dirname, "../fixtures"),
        }]
      }
    };
  }
```

### ☐ 3.4. Test Webpack Changes
```bash
cd e2e/webpack
npm install
npm test
cd ../..
```

### ☐ 3.5. Commit Phase 3
```bash
git add e2e/webpack/
git commit -m "refactor(e2e): update webpack tests to use shared fixtures

- Update imports to point to ../../fixtures/
- Update webpack-configs.ts entry paths
- Update webpack-configs.ts include paths"
```

---

## Phase 4: Update Rollup Tests

### ☐ 4.1. Update Rollup Test Imports

Edit `e2e/rollup/tests/e2e.test.ts`:
```bash
# Find and replace imports
# ../src/ → ../../fixtures/messages/
```

Manually update these lines (same as webpack):
```diff
- import { AuthMessages } from "../src/auth.messages";
+ import { AuthMessages } from "../../fixtures/messages/auth.messages";

- import { AuthMessagesIndexed } from "../src/auth-indexed.messages";
+ import { AuthMessagesIndexed } from "../../fixtures/messages/auth-indexed.messages";

(and all other message imports...)
```

### ☐ 4.2. Update Rollup ICU Test Imports

Edit `e2e/rollup/tests/icu.e2e.test.ts`:
```diff
- import { IcuMessages } from "../src/icu-index";
+ import { IcuMessages } from "../../fixtures/icu-index";
```

### ☐ 4.3. Update rollup-configs.ts

Edit `e2e/rollup/rollup-configs.ts`:
```diff
  function createRollupConfig(options) {
    return {
-     input: `src/${options.entry || 'index.ts'}`,
+     input: `../fixtures/${options.entry || 'index.ts'}`,
      
      plugins: [
        i18nextAutoKeyRollupPlugin({
          // ... config stays same
        }),
      ]
    };
  }
```

### ☐ 4.4. Test Rollup Changes
```bash
cd e2e/rollup
npm install
npm test
cd ../..
```

### ☐ 4.5. Commit Phase 4
```bash
git add e2e/rollup/
git commit -m "refactor(e2e): update rollup tests to use shared fixtures

- Update imports to point to ../../fixtures/
- Update rollup-configs.ts input paths"
```

---

## Phase 5: Update Build Scripts

### ☐ 5.1. Update Root package.json

Edit `package.json` scripts section:
```diff
  "scripts": {
-   "test:e2e": "npm run build && npm run test:e2e:webpack && npm run test:e2e:rollup",
+   "test:e2e": "npm run build && npm run test:e2e:cli && npm run test:e2e:bundlers",
+   "test:e2e:cli": "cd e2e/cli && npm install && npm test",
+   "test:e2e:bundlers": "npm run test:e2e:webpack && npm run test:e2e:rollup",
    "test:e2e:webpack": "cd e2e/webpack && npm install && npm test",
    "test:e2e:rollup": "cd e2e/rollup && npm install && npm test",
  }
```

### ☐ 5.2. Test New Scripts
```bash
# Test individual scripts
npm run test:e2e:cli
npm run test:e2e:webpack
npm run test:e2e:rollup

# Test combined scripts
npm run test:e2e:bundlers
npm run test:e2e
```

### ☐ 5.3. Commit Phase 5
```bash
git add package.json
git commit -m "refactor(e2e): update test scripts for new structure

- Add test:e2e:cli script
- Add test:e2e:bundlers script
- Update test:e2e to include CLI tests"
```

---

## Phase 6: Update Documentation

### ☐ 6.1. Update webpack/README.md

Add note about shared fixtures:
```markdown
## Test Structure

This directory contains webpack-specific integration tests. Test fixtures
are shared across all bundler tests and located in `../fixtures/`.
```

### ☐ 6.2. Update rollup/README.md

Add note about shared fixtures:
```markdown
## Test Structure

This directory contains rollup-specific integration tests. Test fixtures
are shared across all bundler tests and located in `../fixtures/`.
```

### ☐ 6.3. Create e2e/README.md

Create overview:
```bash
cat > e2e/README.md << 'EOF'
# E2E Tests

End-to-end tests for i18next-auto-keys.

## Structure

```
e2e/
├── fixtures/      # Shared test source files
├── cli/           # CLI tests (bundler-agnostic)
├── webpack/       # Webpack integration tests
└── rollup/        # Rollup integration tests
```

## Running Tests

```bash
# All e2e tests
npm run test:e2e

# Individual test suites
npm run test:e2e:cli
npm run test:e2e:webpack
npm run test:e2e:rollup
npm run test:e2e:bundlers
```

## Adding New Bundler Tests

To add tests for a new bundler (e.g., Vite):

1. Create `e2e/vite/` directory
2. Create `vite/tests/` with bundler-specific tests
3. Import fixtures from `../fixtures/`
4. Add test script to root `package.json`
EOF
```

### ☐ 6.4. Update E2E_COMPARISON.md

Update the comparison document to reflect new structure.

### ☐ 6.5. Commit Phase 6
```bash
git add e2e/README.md
git add e2e/webpack/README.md
git add e2e/rollup/README.md
git add e2e/E2E_COMPARISON.md
git commit -m "docs(e2e): update documentation for new structure

- Create e2e/README.md with overview
- Update webpack and rollup READMEs
- Update E2E_COMPARISON.md"
```

---

## Post-Migration Validation

### ☐ V1. Verify Directory Structure
```bash
# Check fixtures exist
[ -d e2e/fixtures/messages ] && echo "✅ fixtures/messages exists"
[ -f e2e/fixtures/index.ts ] && echo "✅ fixtures/index.ts exists"
[ -f e2e/fixtures/icu-index.ts ] && echo "✅ fixtures/icu-index.ts exists"

# Check old directories gone
[ ! -d e2e/webpack/src ] && echo "✅ webpack/src deleted"
[ ! -d e2e/rollup/src ] && echo "✅ rollup/src deleted"

# Check CLI tests moved
[ -d e2e/cli/tests ] && echo "✅ cli/tests exists"
[ -f e2e/cli/tests/cli.e2e.test.ts ] && echo "✅ CLI test exists"
[ -f e2e/cli/tests/config.e2e.test.ts ] && echo "✅ Config test exists"
```

### ☐ V2. Count Files
```bash
# Should have 9 fixture files
find e2e/fixtures -type f | wc -l

# Should have no src directories in bundler folders
find e2e/webpack e2e/rollup -type d -name "src" | wc -l  # Should be 0
```

### ☐ V3. Run All Tests
```bash
# Build the project
npm run build

# Run CLI tests
npm run test:e2e:cli

# Run webpack tests
npm run test:e2e:webpack

# Run rollup tests
npm run test:e2e:rollup

# Run all bundler tests
npm run test:e2e:bundlers

# Run everything
npm run test:e2e
```

### ☐ V4. Check TypeScript
```bash
# No TS errors in webpack tests
cd e2e/webpack && npx tsc --noEmit && cd ../..

# No TS errors in rollup tests
cd e2e/rollup && npx tsc --noEmit && cd ../..

# No TS errors in CLI tests
cd e2e/cli && npx tsc --noEmit && cd ../..
```

### ☐ V5. Compare Before/After
```bash
# Save new structure
tree e2e > /tmp/e2e-after.txt

# Compare
diff /tmp/e2e-before.txt /tmp/e2e-after.txt

# Count reduction
echo "Before: $(cat /tmp/e2e-before.txt | wc -l) lines"
echo "After: $(cat /tmp/e2e-after.txt | wc -l) lines"
```

---

## Final Steps

### ☐ F1. Clean Up
```bash
# Remove any temporary files
find e2e -name "*.log" -delete
find e2e -name ".DS_Store" -delete
```

### ☐ F2. Final Commit
```bash
git status
git add -A
git commit -m "refactor(e2e): complete restructuring

Summary:
- Eliminated duplicate fixtures (9 files)
- Extracted CLI tests to separate directory
- Updated all imports to use shared fixtures
- Reduced total files by 21%
- All tests passing"
```

### ☐ F3. Push and Create PR
```bash
git push origin refactor/e2e-restructure

# Create PR on GitHub
# Title: "Refactor: Restructure e2e tests to eliminate duplication"
# Description: Link to E2E_SUMMARY.md
```

### ☐ F4. Cleanup After Merge
```bash
# After PR is merged
git checkout main
git pull origin main

# Delete feature branch
git branch -d refactor/e2e-restructure
git push origin --delete refactor/e2e-restructure

# Optionally delete backup
git branch -d backup/e2e-pre-restructure
git push origin --delete backup/e2e-pre-restructure
```

---

## Rollback Plan

If anything goes wrong:

### ☐ R1. Quick Rollback (Before Push)
```bash
# Reset to before restructure
git reset --hard backup/e2e-pre-restructure
```

### ☐ R2. Rollback After Push
```bash
# Revert the merge commit
git revert -m 1 <merge-commit-hash>
git push origin main
```

### ☐ R3. Restore from Backup Branch
```bash
git checkout backup/e2e-pre-restructure
git checkout -b restore/e2e-structure
git cherry-pick <commit-range>
```

---

## Checklist Summary

- [ ] Pre-Migration (4 steps)
- [ ] Phase 1: Fixtures (7 steps)
- [ ] Phase 2: CLI Tests (7 steps)
- [ ] Phase 3: Webpack (5 steps)
- [ ] Phase 4: Rollup (5 steps)
- [ ] Phase 5: Scripts (3 steps)
- [ ] Phase 6: Docs (5 steps)
- [ ] Post-Migration (5 checks)
- [ ] Final Steps (4 steps)

**Total**: 45 steps

**Estimated Time**: 2-3 hours

---

## Success Criteria

✅ All 45 steps completed
✅ All tests passing
✅ No TypeScript errors
✅ 9 fewer duplicate files
✅ CLI tests in dedicated directory
✅ Documentation updated
✅ Code review approved
✅ Merged to main

---

## Notes

- Each phase is independently committable
- Can pause between phases
- Tests should pass after each phase
- Git history preserved for all moves

