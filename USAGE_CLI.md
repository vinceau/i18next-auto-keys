# CLI Tool Usage

The `i18next-auto-keys` package includes CLI tools for working with translations independently of your webpack build process:

1. **Extract Messages and Keys** - Extract translation keys from source code and generate a PO template file
2. **Update PO Files** - Merge new strings from PO template into existing .po files
3. **PO to JSON conversion** - Convert translated .po files to i18next JSON format

A PO (portable object) file contains translation strings and is made up of many entries, containing the original untranslated string and its corresponding translation. POT (portable object template) files are similar but serve as templates for creating new PO files. 

## Configuration Integration

CLI tools automatically load project configuration from your config file (see main README for config format).

## Installation

```bash
npm install i18next-auto-keys gettext-parser
# or
yarn add i18next-auto-keys gettext-parser
```

## Usage and Translation Workflow

Here's a complete translation workflow using all three CLI commands:

1. **Extract keys from source code to generate POT** (with config file providing defaults):
   ```bash
   # With config file - output path comes from config
   npx i18next-auto-keys extract --include "**/*.messages.ts"
   
   # Or override config defaults
   npx i18next-auto-keys extract --include "**/*.messages.ts" --output ./custom/path.pot
   ```

2. **Send POT file to translators** who will create language-specific .po files (e.g., es.po, fr.po, de.po)

3. **Update existing .po files with new strings** (when you add new translations):
   ```bash
   # With config file - template path comes from config
   npx i18next-auto-keys update --po-files "./i18n/*.po"
   
   # Or override config defaults
   npx i18next-auto-keys update --template ./custom/template.pot --po-files "./i18n/*.po"
   ```

4. **Convert translated .po files to JSON** (with config defaults):
   ```bash
   # Convert all .po files at once (uses config for top-level-key and indent)
   npx i18next-auto-keys convert --input "./i18n/*.po" --output ./public/locales --batch
   
   # Override config defaults
   npx i18next-auto-keys convert --input "./i18n/*.po" --output ./public/locales --batch --indent 4 --top-level-key translations
   
   # This creates:
   # ./public/locales/es.json
   # ./public/locales/fr.json  
   # ./public/locales/de.json
   ```

5. **Use JSON files with i18next** in your application


### Command Line Options

#### Extract Messages and Keys (`extract`)

- `--include, -i` (required): File patterns to include (e.g., "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx")
- `--output, -o` (optional): Output path for the POT file (defaults to `poTemplatePath` from config)
- `--project-id, -p` (optional): Project ID for POT header (defaults to `projectId` from config)
- `--source, -s`: Source directory to scan for translation keys (default: current directory)
- `--exclude, -e`: File patterns to exclude (default: ["node_modules/**", "dist/**", "build/**"])
- `--tsconfig, -t`: Path to tsconfig.json file (auto-detected if not specified)

**Translation Context Support:**
- Extracts `@translationContext` from JSDoc comments for message disambiguation
- Generates `msgctxt` fields in PO files using actual context (not hash values)
- Organizes messages by context for better translator experience

#### Update PO Files (`update`)

- `--po-files, -p` (required): PO file patterns to update
- `--template, -t` (optional): PO template file path (defaults to `poTemplatePath` from config)
- `--backup, -b`: Create backup files before updating

#### PO to JSON Conversion (`convert`)

- `--input, -i` (required): Input .po file path or glob pattern for multiple files
- `--output, -o` (required): Output JSON file path (for single file) or output directory (for multiple files)
- `--top-level-key, -t` (optional): Wrap translations under a top-level key (defaults to `topLevelKey` from config)
- `--indent` (optional): JSON indentation spaces (defaults to `jsonIndentSpaces` from config)
- `--batch`: Batch mode: treat input as glob pattern and output as directory

### Package.json Scripts

Add to your `package.json` (leveraging config file defaults):

```json
{
  "scripts": {
    "i18n:extract": "i18next-auto-keys extract --include \"**/*.messages.ts\"",
    "i18n:update": "i18next-auto-keys update --po-files \"./i18n/*.po\"",
    "i18n:convert": "i18next-auto-keys convert --input \"./i18n/*.po\" --output ./public/locales --batch"
  }
}
```
