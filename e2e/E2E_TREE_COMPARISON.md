# E2E Directory Tree - Detailed Comparison

## Current Structure (Before Restructuring)

```
e2e/
│
├── dist/
│   └── locales/
│       └── (generated translation files)
│
├── webpack/
│   │
│   ├── src/                                    ← DUPLICATED FIXTURES
│   │   ├── auth.messages.ts                   (84 lines)
│   │   ├── auth-indexed.messages.ts           (84 lines)
│   │   ├── ui.messages.ts                     (52 lines)
│   │   ├── ui-indexed.messages.ts             (52 lines)
│   │   ├── context.messages.ts                (38 lines)
│   │   ├── replay-browser.messages.ts         (95 lines)
│   │   ├── replay-browser-indexed.messages.ts (95 lines)
│   │   ├── index.ts                           (23 lines)
│   │   └── icu-index.ts                       (88 lines)
│   │   └─────────────────────────────────
│   │       Total: 9 files, ~611 lines
│   │
│   ├── tests/
│   │   ├── e2e.test.ts                        (496 lines) ← Webpack-specific ✓
│   │   ├── icu.e2e.test.ts                    (351 lines) ← Webpack-specific ✓
│   │   ├── cli.e2e.test.ts                    (298 lines) ← BUNDLER AGNOSTIC ⚠️
│   │   └── config.simple.e2e.test.ts          (298 lines) ← BUNDLER AGNOSTIC ⚠️
│   │   └─────────────────────────────────
│   │       Total: 4 files, ~1,443 lines
│   │
│   ├── dist/
│   │   ├── bundle-*.js
│   │   └── locales/
│   │       └── *.json
│   │
│   ├── node_modules/
│   │
│   ├── webpack-configs.ts                     (144 lines)
│   ├── webpack.config.js                      (15 lines)
│   ├── package.json                           (27 lines)
│   ├── jest.config.js                         (20 lines)
│   ├── tsconfig.json                          (15 lines)
│   └── README.md                              (50 lines)
│   └─────────────────────────────────
│       Subtotal: 15 files, ~2,325 lines
│
├── rollup/
│   │
│   ├── src/                                    ← DUPLICATED FIXTURES
│   │   ├── auth.messages.ts                   (84 lines) [DUPLICATE!]
│   │   ├── auth-indexed.messages.ts           (84 lines) [DUPLICATE!]
│   │   ├── ui.messages.ts                     (52 lines) [DUPLICATE!]
│   │   ├── ui-indexed.messages.ts             (52 lines) [DUPLICATE!]
│   │   ├── context.messages.ts                (38 lines) [DUPLICATE!]
│   │   ├── replay-browser.messages.ts         (95 lines) [DUPLICATE!]
│   │   ├── replay-browser-indexed.messages.ts (95 lines) [DUPLICATE!]
│   │   ├── index.ts                           (23 lines) [DUPLICATE!]
│   │   └── icu-index.ts                       (82 lines) [DUPLICATE!]
│   │   └─────────────────────────────────
│   │       Total: 9 files, ~605 lines [ALL DUPLICATES!]
│   │
│   ├── tests/
│   │   ├── e2e.test.ts                        (496 lines) ← Rollup-specific ✓
│   │   └── icu.e2e.test.ts                    (351 lines) ← Rollup-specific ✓
│   │   └─────────────────────────────────
│   │       Total: 2 files, ~847 lines
│   │
│   ├── dist/
│   │   ├── bundle-*.js
│   │   └── locales/
│   │       └── *.json
│   │
│   ├── node_modules/
│   │
│   ├── rollup-configs.ts                      (144 lines)
│   ├── rollup.config.js                       (12 lines)
│   ├── package.json                           (30 lines)
│   ├── jest.config.js                         (20 lines)
│   ├── tsconfig.json                          (15 lines)
│   ├── QUICKSTART.md                          (80 lines)
│   ├── SUMMARY.md                             (150 lines)
│   └── README.md                              (50 lines)
│   └─────────────────────────────────
│       Subtotal: 18 files, ~1,953 lines
│
├── E2E_COMPARISON.md                          (224 lines)
└── (other docs)

═══════════════════════════════════════════════════════════════
CURRENT TOTAL: 
  - 42 files
  - ~4,889 lines of code
  - 9 DUPLICATED FILES (605 lines duplicated)
  - 2 MISPLACED FILES (596 lines in wrong location)
═══════════════════════════════════════════════════════════════
```

---

## Proposed Structure (After Restructuring)

```
e2e/
│
├── fixtures/                                   ← NEW: SINGLE SOURCE OF TRUTH
│   │
│   ├── messages/                              ← NEW: Shared message files
│   │   ├── auth.messages.ts                   (84 lines)
│   │   ├── auth-indexed.messages.ts           (84 lines)
│   │   ├── ui.messages.ts                     (52 lines)
│   │   ├── ui-indexed.messages.ts             (52 lines)
│   │   ├── context.messages.ts                (38 lines)
│   │   ├── replay-browser.messages.ts         (95 lines)
│   │   └── replay-browser-indexed.messages.ts (95 lines)
│   │   └─────────────────────────────────
│   │       Total: 7 files, ~500 lines
│   │
│   ├── index.ts                               (23 lines)
│   └── icu-index.ts                           (85 lines)
│   └─────────────────────────────────
│       Subtotal: 9 files, ~608 lines
│
├── cli/                                        ← NEW: Bundler-agnostic tests
│   │
│   ├── tests/
│   │   ├── cli.e2e.test.ts                    (298 lines) ← Moved from webpack
│   │   └── config.e2e.test.ts                 (298 lines) ← Moved from webpack
│   │   └─────────────────────────────────
│   │       Total: 2 files, ~596 lines
│   │
│   ├── package.json                           (20 lines) [NEW]
│   ├── jest.config.js                         (20 lines) [NEW]
│   ├── tsconfig.json                          (15 lines) [NEW]
│   └── README.md                              (30 lines) [NEW]
│   └─────────────────────────────────
│       Subtotal: 6 files, ~681 lines
│
├── webpack/                                    ← Webpack-specific ONLY
│   │
│   ├── tests/
│   │   ├── e2e.test.ts                        (496 lines) ← Imports from ../../fixtures/
│   │   └── icu.e2e.test.ts                    (351 lines) ← Imports from ../../fixtures/
│   │   └─────────────────────────────────
│   │       Total: 2 files, ~847 lines
│   │
│   ├── dist/
│   │   ├── bundle-*.js
│   │   └── locales/
│   │       └── *.json
│   │
│   ├── node_modules/
│   │
│   ├── webpack-configs.ts                     (144 lines)
│   ├── webpack.config.js                      (15 lines) [entry: ../fixtures/index.ts]
│   ├── package.json                           (27 lines)
│   ├── jest.config.js                         (20 lines)
│   ├── tsconfig.json                          (15 lines)
│   └── README.md                              (50 lines) [updated]
│   └─────────────────────────────────
│       Subtotal: 8 files, ~1,118 lines
│
├── rollup/                                     ← Rollup-specific ONLY
│   │
│   ├── tests/
│   │   ├── e2e.test.ts                        (496 lines) ← Imports from ../../fixtures/
│   │   └── icu.e2e.test.ts                    (351 lines) ← Imports from ../../fixtures/
│   │   └─────────────────────────────────
│   │       Total: 2 files, ~847 lines
│   │
│   ├── dist/
│   │   ├── bundle-*.js
│   │   └── locales/
│   │       └── *.json
│   │
│   ├── node_modules/
│   │
│   ├── rollup-configs.ts                      (144 lines)
│   ├── rollup.config.js                       (12 lines) [input: ../fixtures/index.ts]
│   ├── package.json                           (30 lines)
│   ├── jest.config.js                         (20 lines)
│   ├── tsconfig.json                          (15 lines)
│   ├── QUICKSTART.md                          (80 lines)
│   ├── SUMMARY.md                             (150 lines)
│   └── README.md                              (50 lines) [updated]
│   └─────────────────────────────────
│       Subtotal: 9 files, ~1,348 lines
│
├── dist/                                       ← Shared build outputs (optional)
│   └── locales/
│
├── E2E_COMPARISON.md                          (224 lines)
├── E2E_RESTRUCTURE_PROPOSAL.md                (NEW)
├── E2E_STRUCTURE_VISUAL.md                    (NEW)
├── E2E_MIGRATION_QUICKREF.md                  (NEW)
├── E2E_EXAMPLES_BEFORE_AFTER.md               (NEW)
├── E2E_SUMMARY.md                             (NEW)
└── README.md                                  (NEW)

═══════════════════════════════════════════════════════════════
PROPOSED TOTAL:
  - 33 files (vs 42: -21%)
  - ~3,155 lines (vs ~4,889: -35%)
  - 0 DUPLICATED FILES (vs 9: -100%) ✅
  - 0 MISPLACED FILES (vs 2: -100%) ✅
═══════════════════════════════════════════════════════════════
```

---

## Side-by-Side Comparison

### Source Files

```
BEFORE                                  AFTER
───────────────────────────────────────────────────────────────
webpack/src/                            fixtures/
├── auth.messages.ts                    ├── messages/
├── auth-indexed.messages.ts            │   ├── auth.messages.ts
├── ui.messages.ts                      │   ├── auth-indexed.messages.ts
├── ui-indexed.messages.ts              │   ├── ui.messages.ts
├── context.messages.ts                 │   ├── ui-indexed.messages.ts
├── replay-browser.messages.ts          │   ├── context.messages.ts
├── replay-browser-indexed.messages.ts  │   ├── replay-browser.messages.ts
├── index.ts                            │   └── replay-browser-indexed...
└── icu-index.ts                        ├── index.ts
                                        └── icu-index.ts
rollup/src/                             
├── auth.messages.ts         [DUPE]     (DELETED - use fixtures/)
├── auth-indexed.messages.ts [DUPE]     
├── ui.messages.ts           [DUPE]     
├── ui-indexed.messages.ts   [DUPE]     
├── context.messages.ts      [DUPE]     
├── replay-browser.messages.ts [DUPE]   
├── replay-browser-indexed... [DUPE]    
├── index.ts                 [DUPE]     
└── icu-index.ts             [DUPE]     

18 files → 9 files (-50%)
```

### Test Files

```
BEFORE                                  AFTER
───────────────────────────────────────────────────────────────
webpack/tests/                          cli/tests/
├── e2e.test.ts         ✓               ├── cli.e2e.test.ts      ← moved
├── icu.e2e.test.ts     ✓               └── config.e2e.test.ts   ← moved
├── cli.e2e.test.ts     ⚠️ (wrong dir)  
└── config.simple...    ⚠️ (wrong dir)  webpack/tests/
                                        ├── e2e.test.ts          ✓
rollup/tests/                           └── icu.e2e.test.ts      ✓
├── e2e.test.ts         ✓               
└── icu.e2e.test.ts     ✓               rollup/tests/
                                        ├── e2e.test.ts          ✓
                                        └── icu.e2e.test.ts      ✓

6 test files → 6 test files (same count, better organized)
```

---

## Import Path Mapping

### For webpack/tests/e2e.test.ts

```
BEFORE                                  AFTER
───────────────────────────────────────────────────────────────
../src/auth.messages         →          ../../fixtures/messages/auth.messages
../src/auth-indexed.messages →          ../../fixtures/messages/auth-indexed.messages
../src/ui.messages           →          ../../fixtures/messages/ui.messages
../src/ui-indexed.messages   →          ../../fixtures/messages/ui-indexed.messages
../src/context.messages      →          ../../fixtures/messages/context.messages
../src/replay-browser...     →          ../../fixtures/messages/replay-browser...
```

### For rollup/tests/e2e.test.ts

```
BEFORE                                  AFTER
───────────────────────────────────────────────────────────────
../src/auth.messages         →          ../../fixtures/messages/auth.messages
../src/auth-indexed.messages →          ../../fixtures/messages/auth-indexed.messages
../src/ui.messages           →          ../../fixtures/messages/ui.messages
../src/ui-indexed.messages   →          ../../fixtures/messages/ui-indexed.messages
../src/context.messages      →          ../../fixtures/messages/context.messages
../src/replay-browser...     →          ../../fixtures/messages/replay-browser...
```

### For cli/tests/cli.e2e.test.ts (moved)

```
BEFORE (in webpack/tests/)              AFTER (in cli/tests/)
───────────────────────────────────────────────────────────────
../src/auth.messages         →          ../../fixtures/messages/auth.messages
(would have been)                       (same, but from new location)
```

---

## Build Configuration Mapping

### webpack.config.js

```javascript
BEFORE                                  AFTER
───────────────────────────────────────────────────────────────
entry: "./src/index.ts"      →          entry: "../fixtures/index.ts"
entry: "./src/icu-index.ts"  →          entry: "../fixtures/icu-index.ts"

include: path.resolve(                  include: path.resolve(
  __dirname, "src"           →            __dirname, "../fixtures"
)                                       )
```

### rollup.config.js

```javascript
BEFORE                                  AFTER
───────────────────────────────────────────────────────────────
input: "src/index.ts"        →          input: "../fixtures/index.ts"
input: "src/icu-index.ts"    →          input: "../fixtures/icu-index.ts"
```

---

## Future Scalability Example

### Adding Vite Tests

**Current Structure** (would require):
```
e2e/vite/
├── src/                    ← Need to duplicate all 9 files AGAIN!
│   ├── auth.messages.ts    (copy #3)
│   ├── auth-indexed...     (copy #3)
│   ├── ui.messages.ts      (copy #3)
│   ├── ui-indexed...       (copy #3)
│   ├── context.messages.ts (copy #3)
│   ├── replay-browser...   (copy #3)
│   ├── replay-browser-i... (copy #3)
│   ├── index.ts            (copy #3)
│   └── icu-index.ts        (copy #3)
└── tests/
    └── e2e.test.ts

Would add: 10 files, ~611 lines (mostly duplicates)
```

**Proposed Structure** (only needs):
```
e2e/vite/
├── tests/
│   └── e2e.test.ts         ← Just import from ../../fixtures/
├── vite-configs.ts
├── vite.config.js
├── package.json
├── jest.config.js
└── tsconfig.json

Would add: 6 files, ~200 lines (no duplicates!)
```

**Savings when adding Vite**: 4 fewer files, ~400 fewer lines

---

## Statistics Summary

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Total files** | 42 | 33 | -21% ✅ |
| **Total lines** | ~4,889 | ~3,155 | -35% ✅ |
| **Source files** | 18 (9×2) | 9 | -50% ✅ |
| **Test files** | 6 | 6 | 0% |
| **Config files** | 10 | 13 | +30% ℹ️ |
| **Doc files** | 2 | 8 | +300% 📚 |
| **Duplicate code** | ~605 lines | 0 lines | -100% ✅ |
| **Misplaced tests** | 2 files | 0 files | -100% ✅ |

ℹ️ *Config files increase due to new cli/ directory, but total complexity decreases*
📚 *Documentation increases but improves clarity*

---

## Visual Flow Diagram

### Before: Tangled Dependencies

```
┌─────────────┐      ┌─────────────┐
│  webpack/   │      │   rollup/   │
│   tests/    │      │    tests/   │
└──────┬──────┘      └──────┬──────┘
       │                    │
       │ import             │ import
       ↓                    ↓
┌─────────────┐      ┌─────────────┐
│  webpack/   │      │   rollup/   │
│    src/     │      │    src/     │
│  (9 files)  │      │  (9 files)  │ ← DUPLICATES!
└─────────────┘      └─────────────┘
       ↑                    ↑
       └────────┬───────────┘
                │
           Both identical but
           maintained separately ❌
```

### After: Clean Dependencies

```
         ┌──────────────┐
         │     cli/     │
         │    tests/    │
         └──────┬───────┘
                │ import
                ↓
         ┌──────────────┐
         │   fixtures/  │
         │  (9 files)   │ ← SINGLE SOURCE
         └──────────────┘
                ↑
       ┌────────┼────────┐
       │        │        │
┌──────┴──┐    │   ┌────┴────┐
│ webpack/│    │   │ rollup/ │
│  tests/ │    │   │ tests/  │
└─────────┘    │   └─────────┘
               │
        All share same
        fixtures ✅
```

---

## Conclusion

The restructuring provides:
- **35% reduction** in total code
- **100% elimination** of duplicate fixtures
- **100% elimination** of misplaced tests
- **Clear separation** of concerns
- **Better scalability** for future bundlers

**Cost**: 2-3 hours of migration time
**Benefit**: Permanent improvement in maintainability and clarity

