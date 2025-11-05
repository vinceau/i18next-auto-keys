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

## Usage and Translation Workflow

Here's a complete translation workflow using all three CLI commands:

1. **Extract keys from source code**:
   ```bash
   npx i18next-auto-keys extract --include "**/*.messages.ts" --output ./i18n/messages.pot
   ```

2. **Send POT file to translators** who will create language-specific .po files (e.g., es.po, fr.po, de.po)

3. **Update existing .po files with new strings** (when you add new translations):
   ```bash
   npx i18next-auto-keys update --template ./i18n/messages.pot --po-files "./i18n/*.po"
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
