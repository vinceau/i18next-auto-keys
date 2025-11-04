# CLI Tool Usage

The `i18next-auto-keys` package includes CLI tools for working with translations independently of your webpack build process:

1. **POT file generation** - Extract translation keys from source code
2. **PO to JSON conversion** - Convert translated .po files to i18next JSON format

## Installation

```bash
npm install i18next-auto-keys
# or
yarn add i18next-auto-keys
```

## Usage

### POT File Generation

Generate a POT file from your source code:

```bash
# Generate POT file (new command syntax)
npx i18next-auto-keys generate-pot --include "**/*.messages.ts" --output ./i18n/messages.pot

# Or use the shorter alias
npx i18next-auto-keys pot --include "**/*.ts" "**/*.tsx" --output ./i18n/messages.pot

# Scan multiple specific patterns
npx i18next-auto-keys generate-pot --include "src/**/*.ts" "components/**/*.tsx" --output ./i18n/messages.pot
```

#### Advanced POT Generation

```bash
# Full control over file patterns and settings
npx i18next-auto-keys generate-pot \
  --include "src/**/*.messages.ts" "components/**/*.ts" \
  --exclude "**/*.test.ts" "**/__tests__/**" \
  --output ./i18n/messages.pot \
  --project-id "My App 1.0" \
  --tsconfig ./tsconfig.json

# Specify a different search root (optional)
npx i18next-auto-keys pot \
  --source ./frontend \
  --include "**/*.ts" "**/*.tsx" \
  --output ./i18n/messages.pot
```

### PO to JSON Conversion

Convert translated .po files to i18next compatible JSON format:

```bash
# Convert a single .po file to JSON
npx i18next-auto-keys po-to-json --input ./i18n/es.po --output ./public/locales/es.json

# Convert with top-level key wrapping (matches emit plugin)
npx i18next-auto-keys convert --input ./i18n/fr.po --output ./src/locales/fr.json --top-level-key common

# Batch convert multiple .po files
npx i18next-auto-keys po-to-json --input "./i18n/*.po" --output ./public/locales --batch

# Custom formatting
npx i18next-auto-keys convert \
  --input ./i18n/de.po \
  --output ./locales/de.json \
  --top-level-key translations \
  --indent 4
```

### Command Line Options

#### POT Generation (`generate-pot`, `pot`)

- `--output, -o` (required): Output path for the POT file
- `--include, -i` (required): File patterns to include (e.g., "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx")
- `--exclude, -e`: File patterns to exclude (default: ["node_modules/**", "dist/**", "build/**"])
- `--source, -s`: Source directory to scan for translation keys (default: current directory)
- `--project-id, -p`: Project ID for POT header (default: "app 1.0")
- `--tsconfig, -t`: Path to tsconfig.json file (auto-detected if not specified)

#### PO to JSON Conversion (`po-to-json`, `convert`)

- `--input, -i` (required): Input .po file path or glob pattern for multiple files
- `--output, -o` (required): Output JSON file path (for single file) or output directory (for multiple files)
- `--top-level-key, -t`: Wrap translations under a top-level key (matches emit plugin)
- `--indent`: JSON indentation spaces (default: 2)
- `--batch`: Batch mode: treat input as glob pattern and output as directory

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Generate Translation Templates
on:
  push:
    branches: [main]

jobs:
  generate-pot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx i18next-auto-keys generate-pot --include "src/**/*.ts" "src/**/*.tsx" --output ./i18n/messages.pot
      - name: Commit POT file
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add i18n/messages.pot
          git diff --staged --quiet || git commit -m "chore: update translation template"
          git push
```

### Package.json Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "i18n:extract": "i18next-auto-keys generate-pot --include \"**/*.messages.ts\" --output ./i18n/messages.pot",
    "i18n:convert": "i18next-auto-keys po-to-json --input \"./i18n/*.po\" --output ./public/locales --batch"
  }
}
```

## Translation Workflow

Here's a typical workflow using both CLI commands:

1. **Extract keys from source code**:
   ```bash
   npx i18next-auto-keys generate-pot --include "**/*.messages.ts" --output ./i18n/messages.pot
   ```

2. **Send POT file to translators** who will create language-specific .po files (e.g., es.po, fr.po, de.po)

3. **Convert translated .po files to JSON**:
   ```bash
   # Convert all .po files at once
   npx i18next-auto-keys po-to-json --input "./i18n/*.po" --output ./public/locales --batch
   
   # This creates:
   # ./public/locales/es.json
   # ./public/locales/fr.json  
   # ./public/locales/de.json
   ```

4. **Use JSON files with i18next** in your application
