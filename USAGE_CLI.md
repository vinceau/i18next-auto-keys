# CLI Tool Usage

The `i18next-auto-keys` package includes CLI tools for working with translations independently of your webpack build process:

1. **Extract Messages and Keys** - Extract translation keys from source code and generate a POT template file
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
# Generate POT file
npx i18next-auto-keys extract --include "**/*.messages.ts" --output ./i18n/messages.pot

# Include multiple file patterns
npx i18next-auto-keys extract --include "**/*.ts" "**/*.tsx" --output ./i18n/messages.pot

# Scan specific directories
npx i18next-auto-keys extract --include "src/**/*.ts" "components/**/*.tsx" --output ./i18n/messages.pot
```

#### Advanced POT Generation

```bash
# Full control over file patterns and settings
npx i18next-auto-keys extract \
  --include "src/**/*.messages.ts" "components/**/*.ts" \
  --exclude "**/*.test.ts" "**/__tests__/**" \
  --output ./i18n/messages.pot \
  --project-id "My App 1.0" \
  --tsconfig ./tsconfig.json

# Specify a different search root (optional)
npx i18next-auto-keys extract \
  --source ./frontend \
  --include "**/*.ts" "**/*.tsx" \
  --output ./i18n/messages.pot
```

### Update PO Files

Update existing .po files with new strings from a POT template:

```bash
# Update all .po files from template
npx i18next-auto-keys update --template ./i18n/messages.pot --po-files "./i18n/*.po"

# Update specific .po files with backup
npx i18next-auto-keys update \
  --template ./i18n/messages.pot \
  --po-files "./i18n/es.po" "./i18n/fr.po" \
  --backup

# Update files in multiple directories
npx i18next-auto-keys update \
  --template ./i18n/messages.pot \
  --po-files "./locales/**/*.po" "./translations/*.po"
```

### Convert PO to JSON

Convert translated .po files to i18next compatible JSON format:

```bash
# Convert a single .po file to JSON
npx i18next-auto-keys convert --input ./i18n/es.po --output ./public/locales/es.json

# Convert with top-level key wrapping (matches emit plugin)
npx i18next-auto-keys convert --input ./i18n/fr.po --output ./src/locales/fr.json --top-level-key common

# Batch convert multiple .po files
npx i18next-auto-keys convert --input "./i18n/*.po" --output ./public/locales --batch

# Custom formatting
npx i18next-auto-keys convert \
  --input ./i18n/de.po \
  --output ./locales/de.json \
  --top-level-key translations \
  --indent 4
```

### Command Line Options

#### Extract Messages and Keys (`extract`)

- `--output, -o` (required): Output path for the POT file
- `--include, -i` (required): File patterns to include (e.g., "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx")
- `--exclude, -e`: File patterns to exclude (default: ["node_modules/**", "dist/**", "build/**"])
- `--source, -s`: Source directory to scan for translation keys (default: current directory)
- `--project-id, -p`: Project ID for POT header (default: "app 1.0")
- `--tsconfig, -t`: Path to tsconfig.json file (auto-detected if not specified)

#### Update PO Files (`update`)

- `--template, -t` (required): POT template file path
- `--po-files, -p` (required): PO file patterns to update
- `--backup, -b`: Create backup files before updating

#### PO to JSON Conversion (`convert`)

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
  extract-pot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx i18next-auto-keys extract --include "src/**/*.ts" "src/**/*.tsx" --output ./i18n/messages.pot
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
    "i18n:extract": "i18next-auto-keys extract --include \"**/*.messages.ts\" --output ./i18n/messages.pot",
    "i18n:update": "i18next-auto-keys update --template ./i18n/messages.pot --po-files \"./i18n/*.po\"",
    "i18n:convert": "i18next-auto-keys convert --input \"./i18n/*.po\" --output ./public/locales --batch"
  }
}
```

## Translation Workflow

Here's a complete translation workflow using all three CLI commands:

1. **Extract keys from source code**:
   ```bash
   npx i18next-auto-keys extract --include "**/*.messages.ts" --output ./i18n/messages.pot
   ```

2. **Send POT file to translators** who will create language-specific .po files (e.g., es.po, fr.po, de.po)

3. **Update existing .po files with new strings** (when you add new translations):
   ```bash
   npx i18next-auto-keys update --template ./i18n/messages.pot --po-files "./i18n/*.po" --backup
   ```

4. **Convert translated .po files to JSON**:
   ```bash
   # Convert all .po files at once
   npx i18next-auto-keys convert --input "./i18n/*.po" --output ./public/locales --batch
   
   # This creates:
   # ./public/locales/es.json
   # ./public/locales/fr.json  
   # ./public/locales/de.json
   ```

5. **Use JSON files with i18next** in your application
