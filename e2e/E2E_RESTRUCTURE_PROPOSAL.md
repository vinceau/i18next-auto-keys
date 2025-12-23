# E2E Test Structure Restructuring Proposal

## Current Problems

1. **Source File Duplication**: The `src/` directory is duplicated in both `webpack/` and `rollup/` folders with identical content
2. **CLI Test Misplacement**: CLI tests in `webpack/tests/cli.e2e.test.ts` are bundler-agnostic but live in a bundler-specific folder
3. **Config Test Misplacement**: Config tests in `webpack/tests/config.simple.e2e.test.ts` are also bundler-agnostic
4. **Maintenance Burden**: Changes to test fixtures require updates in multiple locations
5. **Unclear Organization**: Not immediately clear which tests are bundler-specific vs shared

## Proposed New Structure

```
e2e/
├── fixtures/                           # Shared test source files
│   ├── messages/                       # Message function test files
│   │   ├── auth.messages.ts
│   │   ├── auth-indexed.messages.ts
│   │   ├── ui.messages.ts
│   │   ├── ui-indexed.messages.ts
│   │   ├── context.messages.ts
│   │   ├── replay-browser.messages.ts
│   │   └── replay-browser-indexed.messages.ts
│   ├── icu-index.ts                    # ICU message entry point
│   └── index.ts                        # Standard message entry point
│
├── cli/                                # Bundler-agnostic CLI tests
│   ├── tests/
│   │   ├── cli.e2e.test.ts            # CLI command tests
│   │   └── config.e2e.test.ts         # Config file loading tests
│   ├── jest.config.js
│   ├── package.json
│   └── tsconfig.json
│
├── webpack/                            # Webpack-specific tests
│   ├── tests/
│   │   ├── e2e.test.ts                # Standard transformation tests
│   │   └── icu.e2e.test.ts            # ICU message format tests
│   ├── webpack-configs.ts             # Helper to create webpack configs
│   ├── webpack.config.js
│   ├── jest.config.js
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
├── rollup/                             # Rollup-specific tests
│   ├── tests/
│   │   ├── e2e.test.ts                # Standard transformation tests
│   │   └── icu.e2e.test.ts            # ICU message format tests
│   ├── rollup-configs.ts              # Helper to create rollup configs
│   ├── rollup.config.js
│   ├── jest.config.js
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
├── dist/                               # Shared build outputs (gitignored)
│   └── locales/
│
├── E2E_COMPARISON.md                   # Documentation
└── README.md                           # Overview of e2e test suite
```

## Key Changes

### 1. Shared Fixtures Directory

**Before:**
- `webpack/src/` (9 files)
- `rollup/src/` (9 files - duplicates)

**After:**
- `fixtures/` (9 files - single source of truth)

All bundler tests will import from `../fixtures/` instead of their own `src/` directories.

### 2. CLI Test Directory

**Before:**
- `webpack/tests/cli.e2e.test.ts`
- `webpack/tests/config.simple.e2e.test.ts`

**After:**
- `cli/tests/cli.e2e.test.ts`
- `cli/tests/config.e2e.test.ts`

These tests focus on CLI functionality and are independent of any bundler. They will have their own Jest configuration and can run independently.

### 3. Bundler-Specific Tests

Each bundler directory will only contain:
- Tests specific to that bundler's integration
- Configuration helpers
- Build configuration files
- Dependencies specific to that bundler

### 4. Shared Build Outputs

Instead of each bundler having its own `dist/` directory, they can share a common `e2e/dist/` directory to reduce redundancy (optional - can keep separate if needed for isolation).

## Migration Benefits

### ✅ Eliminated Duplication
- 9 source files → 1 copy (saves ~1KB of identical code)
- Single point of maintenance for test fixtures

### ✅ Clear Separation of Concerns
- CLI tests clearly separated from bundler tests
- Easy to understand what each directory tests

### ✅ Better Scalability
- Adding Vite-specific tests? Just create `e2e/vite/`
- Adding esbuild tests? Just create `e2e/esbuild/`
- All can share the same fixtures

### ✅ Improved Test Organization
```
npm run test:e2e:cli      # Run CLI tests only
npm run test:e2e:webpack  # Run webpack integration tests
npm run test:e2e:rollup   # Run rollup integration tests
npm run test:e2e:bundlers # Run all bundler tests
npm run test:e2e          # Run everything
```

### ✅ Maintenance Improvements
- Update a message fixture once, all tests benefit
- Clear which tests need updating when changing bundler-specific code
- Easier to identify and fix failing tests

## Migration Steps

### Phase 1: Create Shared Fixtures
1. Create `e2e/fixtures/` directory
2. Create `e2e/fixtures/messages/` subdirectory
3. Move message files from `webpack/src/` to `fixtures/messages/`
4. Move `index.ts` and `icu-index.ts` to `fixtures/`

### Phase 2: Extract CLI Tests
1. Create `e2e/cli/` directory structure
2. Move `cli.e2e.test.ts` from `webpack/tests/` to `cli/tests/`
3. Rename and move `config.simple.e2e.test.ts` to `cli/tests/config.e2e.test.ts`
4. Create `cli/package.json` with minimal dependencies
5. Create `cli/jest.config.js`

### Phase 3: Update Webpack Tests
1. Update imports in `webpack/tests/` to reference `../fixtures/`
2. Update webpack configs to point to fixtures
3. Remove `webpack/src/` directory
4. Update `webpack/README.md` to reflect new structure

### Phase 4: Update Rollup Tests
1. Update imports in `rollup/tests/` to reference `../fixtures/`
2. Update rollup configs to point to fixtures
3. Remove `rollup/src/` directory
4. Update `rollup/README.md` to reflect new structure

### Phase 5: Update Build Scripts
1. Update root `package.json` scripts:
   ```json
   {
     "test:e2e": "npm run test:e2e:cli && npm run test:e2e:bundlers",
     "test:e2e:cli": "cd e2e/cli && npm install && npm test",
     "test:e2e:bundlers": "npm run test:e2e:webpack && npm run test:e2e:rollup",
     "test:e2e:webpack": "cd e2e/webpack && npm install && npm test",
     "test:e2e:rollup": "cd e2e/rollup && npm install && npm test"
   }
   ```

### Phase 6: Documentation Updates
1. Update `E2E_COMPARISON.md` to reflect new structure
2. Create `e2e/README.md` with overview
3. Update individual bundler READMEs

## Import Path Changes

### Webpack Tests

**Before:**
```typescript
import { AuthMessages } from "../src/auth.messages";
```

**After:**
```typescript
import { AuthMessages } from "../../fixtures/messages/auth.messages";
```

### Rollup Tests

**Before:**
```typescript
import { AuthMessages } from "../src/auth.messages";
```

**After:**
```typescript
import { AuthMessages } from "../../fixtures/messages/auth.messages";
```

### Build Configs

**Webpack Before:**
```javascript
entry: "./src/index.ts"
```

**Webpack After:**
```javascript
entry: "../fixtures/index.ts"
```

**Rollup Before:**
```javascript
input: "src/index.ts"
```

**Rollup After:**
```javascript
input: "../fixtures/index.ts"
```

## Testing the Migration

After each phase, verify:

1. **CLI Tests**: `npm run test:e2e:cli`
2. **Webpack Tests**: `npm run test:e2e:webpack`
3. **Rollup Tests**: `npm run test:e2e:rollup`
4. **All E2E**: `npm run test:e2e`

All tests should pass at each phase.

## Rollback Plan

If issues arise during migration:
1. Git commits at each phase allow easy rollback
2. Can revert specific bundler changes without affecting others
3. Fixtures can be temporarily duplicated back if needed

## Alternative Considerations

### Option A: Monorepo with Workspaces
Use npm/yarn workspaces to manage the e2e tests as a monorepo:
```
e2e/
├── packages/
│   ├── fixtures/
│   ├── cli/
│   ├── webpack/
│   └── rollup/
└── package.json (workspace root)
```

**Pros**: Better dependency management, shared dependencies
**Cons**: More complex setup, might be overkill for this project

### Option B: Symlinks
Keep current structure but use symlinks for `src/` directories:
```bash
ln -s ../shared-src webpack/src
ln -s ../shared-src rollup/src
```

**Pros**: Minimal code changes
**Cons**: Symlinks can be problematic on Windows, less clear

### Option C: Keep Current Structure
Don't change anything.

**Pros**: No migration effort, no risk
**Cons**: Duplication persists, maintenance burden continues

## Recommendation

**Implement the proposed structure** (main proposal above) because:

1. ✅ Cleanest solution - no symlink complexity
2. ✅ Scales well for future bundlers (Vite, esbuild, etc.)
3. ✅ Clear separation between shared and bundler-specific code
4. ✅ CLI tests properly isolated
5. ✅ Low migration risk with incremental phases
6. ✅ Better developer experience

## Future Enhancements

After restructuring, consider:

1. **Vite E2E Tests**: Add `e2e/vite/` using shared fixtures
2. **Shared Test Utilities**: Create `e2e/test-utils/` for common helpers
3. **Parallel Test Execution**: Run bundler tests in parallel
4. **Visual Regression Tests**: Add screenshot comparison tests
5. **Performance Benchmarks**: Track build times across bundlers

## Questions for Review

1. Should `dist/` outputs be shared or kept separate per bundler?
2. Should we create a `fixtures/tsconfig.json` or rely on bundler configs?
3. Do we want to add a shared `test-utils` directory now or later?
4. Should CLI tests have their own `node_modules` or share with root?

---

**Status**: 📋 Proposal - Awaiting Review
**Impact**: Medium - Requires coordinated file moves and import updates
**Risk**: Low - Can be done incrementally with rollback points
**Timeline**: 2-3 hours for complete migration

