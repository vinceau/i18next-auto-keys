# CLI Tool Usage - POT File Generation

The `i18next-auto-keys` package includes a CLI tool for generating POT (Portable Object Template) files independently of your webpack build process.

## Installation

```bash
npm install i18next-auto-keys
# or
yarn add i18next-auto-keys
```

## Usage

### Basic Usage

Generate a POT file from your source code:

```bash
# Scan all TypeScript/JavaScript files in current directory and subdirectories
npx i18next-auto-keys --include "**/*.ts" "**/*.tsx" "**/*.js" "**/*.jsx" --output ./i18n/messages.pot

# Or scan only specific message files
npx i18next-auto-keys --include "**/*.messages.ts" --output ./i18n/messages.pot

# Scan multiple specific patterns
npx i18next-auto-keys --include "src/**/*.ts" "components/**/*.tsx" --output ./i18n/messages.pot
```

### Advanced Usage

```bash
# Full control over file patterns and settings
npx i18next-auto-keys \
  --include "src/**/*.messages.ts" "components/**/*.ts" \
  --exclude "**/*.test.ts" "**/__tests__/**" \
  --output ./i18n/messages.pot \
  --project-id "My App 1.0" \
  --tsconfig ./tsconfig.json

# Specify a different search root (optional)
npx i18next-auto-keys \
  --source ./frontend \
  --include "**/*.ts" "**/*.tsx" \
  --output ./i18n/messages.pot
```

### Command Line Options

- `--output, -o` (required): Output path for the POT file
- `--include, -i` (required): File patterns to include (e.g., "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx")  
- `--exclude, -e`: File patterns to exclude (default: ["node_modules/**", "dist/**", "build/**"])
- `--source, -s`: Source directory to scan for translation keys (default: current directory)
- `--project-id, -p`: Project ID for POT header (default: "app 1.0")
- `--tsconfig, -t`: Path to tsconfig.json file (auto-detected if not specified)

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
      - run: npx i18next-auto-keys --include "src/**/*.ts" "src/**/*.tsx" --output ./i18n/messages.pot
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
    "i18n:extract": "i18next-auto-keys --include \"src/**/*.ts\" \"src/**/*.tsx\" --output ./i18n/messages.pot",
    "i18n:extract:messages": "i18next-auto-keys --include \"**/*.messages.ts\" --output ./i18n/messages.pot", 
    "i18n:extract:all": "i18next-auto-keys --include \"**/*.ts\" \"**/*.tsx\" \"**/*.js\" \"**/*.jsx\" --output ./i18n/messages.pot",
    "i18n:extract:watch": "chokidar \"src/**/*.{ts,tsx,js,jsx}\" -c \"npm run i18n:extract\""
  }
}
```

## Benefits over Webpack Plugin

- **Performance**: No impact on webpack build times
- **Flexibility**: Generate POT files independently of builds
- **CI/CD Friendly**: Easy to integrate into automated workflows
- **Development Workflow**: Translators can generate fresh templates without rebuilding
- **Dependency Optimization**: `gettext-parser` only needed when generating POT files

## Migration from Webpack Plugin

If you were previously using the webpack plugin's `potOutputPath` option:

### Before
```javascript
new I18nextAutoKeyEmitPlugin({
  jsonOutputPath: "i18n/en.json",
  potOutputPath: "i18n/messages.pot", // Remove this
  projectIdVersion: "My App 1.0"
})
```

### After
```javascript
// Webpack plugin (simplified)
new I18nextAutoKeyEmitPlugin({
  jsonOutputPath: "i18n/en.json"
})
```

```bash
# Use CLI for POT generation
npx i18next-auto-keys --include "src/**/*.ts" "src/**/*.tsx" --output ./dist/i18n/messages.pot --project-id "My App 1.0"
```
