# E2E Test Structure - Visual Comparison

## Current Structure (With Duplication) ❌

```
e2e/
│
├── webpack/
│   ├── src/                                    ┐
│   │   ├── auth.messages.ts                   │
│   │   ├── auth-indexed.messages.ts           │
│   │   ├── ui.messages.ts                     │ DUPLICATED
│   │   ├── ui-indexed.messages.ts             │ FIXTURES
│   │   ├── context.messages.ts                │ (identical
│   │   ├── replay-browser.messages.ts         │  content)
│   │   ├── replay-browser-indexed.messages.ts │
│   │   ├── index.ts                           │
│   │   └── icu-index.ts                       ┘
│   │
│   ├── tests/
│   │   ├── e2e.test.ts              ← Webpack-specific ✓
│   │   ├── icu.e2e.test.ts          ← Webpack-specific ✓
│   │   ├── cli.e2e.test.ts          ← BUNDLER AGNOSTIC ⚠️
│   │   └── config.simple.e2e.test.ts ← BUNDLER AGNOSTIC ⚠️
│   │
│   ├── webpack-configs.ts
│   ├── webpack.config.js
│   ├── dist/
│   ├── package.json
│   ├── jest.config.js
│   └── tsconfig.json
│
└── rollup/
    ├── src/                                    ┐
    │   ├── auth.messages.ts                   │
    │   ├── auth-indexed.messages.ts           │
    │   ├── ui.messages.ts                     │ DUPLICATED
    │   ├── ui-indexed.messages.ts             │ FIXTURES
    │   ├── context.messages.ts                │ (identical
    │   ├── replay-browser.messages.ts         │  content)
    │   ├── replay-browser-indexed.messages.ts │
    │   ├── index.ts                           │
    │   └── icu-index.ts                       ┘
    │
    ├── tests/
    │   ├── e2e.test.ts              ← Rollup-specific ✓
    │   └── icu.e2e.test.ts          ← Rollup-specific ✓
    │
    ├── rollup-configs.ts
    ├── rollup.config.js
    ├── dist/
    ├── package.json
    ├── jest.config.js
    └── tsconfig.json
```

### Issues:
- 🔴 **18 duplicate source files** (9 in webpack, 9 in rollup)
- 🔴 **CLI tests misplaced** in webpack folder
- 🔴 **Config tests misplaced** in webpack folder
- 🔴 **Maintenance burden**: Update fixtures in 2 places
- 🔴 **Unclear organization**: Which tests are shared vs bundler-specific?

---

## Proposed Structure (No Duplication) ✅

```
e2e/
│
├── fixtures/                          ← SINGLE SOURCE OF TRUTH
│   ├── messages/                      
│   │   ├── auth.messages.ts          ┐
│   │   ├── auth-indexed.messages.ts  │
│   │   ├── ui.messages.ts            │ SHARED TEST
│   │   ├── ui-indexed.messages.ts    │ FIXTURES
│   │   ├── context.messages.ts       │ (one copy only)
│   │   ├── replay-browser.messages.ts│
│   │   └── replay-browser-indexed... ┘
│   ├── index.ts
│   └── icu-index.ts
│
├── cli/                               ← BUNDLER AGNOSTIC TESTS
│   ├── tests/
│   │   ├── cli.e2e.test.ts           ✓ Tests CLI commands
│   │   └── config.e2e.test.ts        ✓ Tests config loading
│   ├── package.json
│   ├── jest.config.js
│   └── tsconfig.json
│
├── webpack/                           ← WEBPACK-SPECIFIC TESTS ONLY
│   ├── tests/
│   │   ├── e2e.test.ts               ✓ Webpack integration
│   │   └── icu.e2e.test.ts           ✓ Webpack ICU support
│   │       
│   │       (imports from ../../fixtures/)
│   │
│   ├── webpack-configs.ts
│   ├── webpack.config.js
│   ├── dist/
│   ├── package.json
│   ├── jest.config.js
│   ├── tsconfig.json
│   └── README.md
│
└── rollup/                            ← ROLLUP-SPECIFIC TESTS ONLY
    ├── tests/
    │   ├── e2e.test.ts                ✓ Rollup integration
    │   └── icu.e2e.test.ts            ✓ Rollup ICU support
    │       
    │       (imports from ../../fixtures/)
    │
    ├── rollup-configs.ts
    ├── rollup.config.js
    ├── dist/
    ├── package.json
    ├── jest.config.js
    ├── tsconfig.json
    └── README.md
```

### Benefits:
- ✅ **Zero duplication**: 9 files instead of 18
- ✅ **Clear separation**: CLI, webpack, rollup each in their own space
- ✅ **Single source of truth**: Update fixtures once
- ✅ **Better scalability**: Easy to add Vite, esbuild, etc.
- ✅ **Clearer intent**: Test organization matches what they test

---

## Test Dependencies Flow

### Current (Tangled)
```
┌─────────────────────────────────────┐
│  webpack/tests/                     │
│  ├── e2e.test.ts        (webpack)   │──┐
│  ├── icu.e2e.test.ts    (webpack)   │  │
│  ├── cli.e2e.test.ts    (agnostic!) │  │
│  └── config...test.ts   (agnostic!) │  │
└─────────────────────────────────────┘  │
             │                           │
             ├───imports──────────────┐  │
             ↓                        │  │
    webpack/src/ (fixtures)           │  │
                                      │  │
┌─────────────────────────────────────┐ │
│  rollup/tests/                      │ │
│  ├── e2e.test.ts        (rollup)    │ │
│  └── icu.e2e.test.ts    (rollup)    │ │
└─────────────────────────────────────┘ │
             │                          │
             ├───imports─────────────┐  │
             ↓                       │  │
    rollup/src/ (fixtures - DUPE!)   │  │
                                     │  │
    ⚠️ Confused dependencies         │  │
    ⚠️ CLI tests in wrong place      ┘  │
```

### Proposed (Clear)
```
┌─────────────────────────────────────┐
│  fixtures/                          │
│  ├── messages/                      │
│  │   └── *.messages.ts              │
│  ├── index.ts                       │
│  └── icu-index.ts                   │
└─────────────────────────────────────┘
              ↑       ↑       ↑
              │       │       │
      ┌───────┴───────┼───────┴──────┐
      │               │              │
┌─────┴──────┐  ┌─────┴──────┐  ┌────┴──────┐
│ cli/tests/ │  │webpack/    │  │rollup/    │
│            │  │ tests/     │  │ tests/    │
│ cli.test   │  │            │  │           │
│ config.test│  │ e2e.test   │  │ e2e.test  │
│            │  │ icu.test   │  │ icu.test  │
└────────────┘  └────────────┘  └───────────┘
  ✓ Agnostic    ✓ Webpack-     ✓ Rollup-
                  specific       specific
```

---

## Import Path Changes

### Before (Duplication)

**In `webpack/tests/e2e.test.ts`:**
```typescript
import { AuthMessages } from "../src/auth.messages";
import { UiMessages } from "../src/ui.messages";
```

**In `rollup/tests/e2e.test.ts`:**
```typescript
import { AuthMessages } from "../src/auth.messages";  // DUPLICATE
import { UiMessages } from "../src/ui.messages";      // DUPLICATE
```

### After (Shared)

**In `webpack/tests/e2e.test.ts`:**
```typescript
import { AuthMessages } from "../../fixtures/messages/auth.messages";
import { UiMessages } from "../../fixtures/messages/ui.messages";
```

**In `rollup/tests/e2e.test.ts`:**
```typescript
import { AuthMessages } from "../../fixtures/messages/auth.messages";
import { UiMessages } from "../../fixtures/messages/ui.messages";
```

**In `cli/tests/cli.e2e.test.ts`:**
```typescript
import { AuthMessages } from "../../fixtures/messages/auth.messages";
import { UiMessages } from "../../fixtures/messages/ui.messages";
```

---

## Future Scalability

### Adding a New Bundler (e.g., Vite)

**Current Structure** (requires duplication):
```
e2e/vite/
├── src/                    ← Would need to DUPLICATE all 9 files AGAIN
│   └── *.messages.ts
└── tests/
    └── e2e.test.ts
```

**Proposed Structure** (no duplication):
```
e2e/vite/
├── tests/
│   └── e2e.test.ts         ← Just imports from ../../fixtures/
├── vite-configs.ts
├── vite.config.js
└── package.json
```

### Adding a New Test Fixture

**Current**: Add to both `webpack/src/` AND `rollup/src/`
**Proposed**: Add once to `fixtures/messages/`, available to all

---

## Test Execution Commands

### Current
```bash
npm run test:e2e           # webpack + rollup
npm run test:e2e:webpack   # webpack (includes CLI tests)
npm run test:e2e:rollup    # rollup only
# No way to run just CLI tests!
```

### Proposed
```bash
npm run test:e2e              # All e2e tests
npm run test:e2e:cli          # CLI tests only ✨ NEW
npm run test:e2e:webpack      # Webpack integration only
npm run test:e2e:rollup       # Rollup integration only
npm run test:e2e:bundlers     # All bundler tests ✨ NEW
```

---

## File Count Comparison

### Current
```
webpack/src/        9 files
rollup/src/         9 files (duplicates)
webpack/tests/      4 files (2 misplaced)
rollup/tests/       2 files
─────────────────────
Total:             24 files
Duplicates:         9 files ❌
Misplaced:          2 files ❌
```

### Proposed
```
fixtures/messages/  7 files
fixtures/           2 files
cli/tests/          2 files (properly placed)
webpack/tests/      2 files
rollup/tests/       2 files
─────────────────────
Total:             15 files
Duplicates:         0 files ✅
Misplaced:          0 files ✅
```

**Reduction**: 24 → 15 files (-37.5%)

---

## Summary

| Aspect | Current | Proposed | Improvement |
|--------|---------|----------|-------------|
| Duplicate fixtures | 9 files | 0 files | ✅ -100% |
| Total test files | 24 | 15 | ✅ -37% |
| Misplaced tests | 2 | 0 | ✅ Fixed |
| Clarity | 🔴 Low | 🟢 High | ✅ Better |
| Maintainability | 🔴 Hard | 🟢 Easy | ✅ Better |
| Scalability | 🟡 Medium | 🟢 High | ✅ Better |
| Migration effort | - | 2-3 hours | 🟡 Moderate |

**Recommendation**: ✅ Proceed with restructuring

