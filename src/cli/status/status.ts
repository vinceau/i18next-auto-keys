import * as fs from "fs";
import * as path from "path";
import { globSync } from "glob";
import { loadGettextParser } from "../loadGettextParser";

export type StatusOptions = {
  directory: string;
  verbose?: boolean;
};

export type LanguageStatus = {
  language: string;
  file: string;
  total: number;
  translated: number;
  untranslated: number;
  progress: number; // percentage (0-100)
};

/**
 * Analyzes .po files in a directory and shows translation progress for each language.
 */
export async function showTranslationStatus(options: StatusOptions): Promise<void> {
  const { directory, verbose = false } = options;

  console.log(`📊 Analyzing translation status in: ${directory}`);

  // Check if directory exists
  if (!fs.existsSync(directory)) {
    throw new Error(`Directory not found: ${directory}`);
  }

  // Find all .po files in the directory
  const pattern = path.join(directory, "**/*.po");
  const poFiles = globSync(pattern, { absolute: true });

  if (poFiles.length === 0) {
    console.warn("⚠️  No .po files found in the specified directory");
    return;
  }

  console.log(`📁 Found ${poFiles.length} .po file(s)\n`);

  // Analyze each .po file
  const results: LanguageStatus[] = [];

  for (const poFile of poFiles) {
    try {
      const status = await analyzePoFile(poFile);
      results.push(status);
    } catch (error) {
      console.error(`❌ Error analyzing ${poFile}:`, error);
    }
  }

  // Sort results by progress (descending) then by language name
  results.sort((a, b) => {
    if (b.progress !== a.progress) {
      return b.progress - a.progress;
    }
    return a.language.localeCompare(b.language);
  });

  // Display results
  displayResults(results, verbose);
}

async function analyzePoFile(filePath: string): Promise<LanguageStatus> {
  // Load gettext parser
  const parser = await loadGettextParser();
  if (!parser?.po?.parse) {
    throw new Error("gettext-parser is required to parse .po files. Install it with: npm install gettext-parser");
  }

  // Read and parse .po file
  const poBuffer = fs.readFileSync(filePath);
  const catalog = parser.po.parse(poBuffer);

  // Extract language from headers or filename
  const language = extractLanguage(catalog, filePath);

  let total = 0;
  let translated = 0;

  // Count translations
  // Note: gettext-parser structure is translations[msgctxt][msgid] = entryData
  for (const [contextKey, contextEntries] of Object.entries(catalog.translations)) {
    for (const [msgid, entryData] of Object.entries(contextEntries as any)) {
      if (msgid === "" || !entryData) continue; // Skip header entry

      total++;

      // Check if translation exists (first msgstr is not empty)
      const msgstr = (entryData as any).msgstr[0] || "";
      if (msgstr.trim()) {
        translated++;
      }
    }
  }

  const untranslated = total - translated;
  const progress = total > 0 ? Math.round((translated / total) * 100) : 0;

  return {
    language,
    file: path.basename(filePath),
    total,
    translated,
    untranslated,
    progress,
  };
}

function extractLanguage(catalog: any, filePath: string): string {
  // Try to get language from headers first
  if (catalog.headers?.language) {
    return catalog.headers.language;
  }

  // Try to extract from filename (e.g., "fr.po" -> "fr", "fr_FR.po" -> "fr_FR")
  const basename = path.basename(filePath, ".po");

  // Common language code patterns
  const languageMatch = basename.match(/^([a-z]{2}(_[A-Z]{2})?)$/);
  if (languageMatch) {
    return languageMatch[1];
  }

  // If no clear language pattern, use the basename
  return basename;
}

function displayResults(results: LanguageStatus[], verbose: boolean): void {
  if (results.length === 0) {
    console.log("📄 No translation data found");
    return;
  }

  // Calculate overall statistics
  const totals = results.reduce(
    (acc, curr) => ({
      total: acc.total + curr.total,
      translated: acc.translated + curr.translated,
    }),
    { total: 0, translated: 0 }
  );

  const overallProgress = totals.total > 0 ? Math.round((totals.translated / totals.total) * 100) : 0;

  // Header
  console.log("Translation Progress Summary");
  console.log("═".repeat(50));

  // Individual language results
  for (const result of results) {
    const progressBar = createProgressBar(result.progress);
    const progressEmoji = getProgressEmoji(result.progress);

    console.log(`${progressEmoji} ${result.language.padEnd(12)} ${progressBar} ${result.progress}%`);

    if (verbose) {
      console.log(`    File: ${result.file}`);
      console.log(`    Translated: ${result.translated}/${result.total} (${result.untranslated} remaining)`);
      console.log();
    } else {
      console.log(`    ${result.translated}/${result.total} strings translated${verbose ? ` (${result.file})` : ""}`);
    }
  }

  // Overall summary
  console.log("─".repeat(50));
  console.log(`📈 Overall: ${totals.translated}/${totals.total} strings (${overallProgress}%)`);
  console.log(`📚 Languages: ${results.length}`);
}

function createProgressBar(progress: number, width: number = 20): string {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

function getProgressEmoji(progress: number): string {
  if (progress === 100) return "✅";
  if (progress >= 80) return "🟢";
  if (progress >= 60) return "🟡";
  if (progress >= 40) return "🟠";
  if (progress >= 20) return "🔶";
  return "🔴";
}
