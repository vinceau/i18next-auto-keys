import fs from "fs";
import path from "path";
import { sync as globSync } from "glob";
import ts from "typescript";
import { i18nStore, createI18nextAutoKeyTransformerFactory } from "../../index";
import { loadGettextParser } from "../loadGettextParser";
import type { GetTextTranslationRecord } from "gettext-parser";

export type ExtractOptions = {
  source?: string;
  output: string;
  projectId?: string;
  include: string[];
  exclude?: string[];
  tsconfig?: string;
};

/**
 * Scans TypeScript/JavaScript source files and generates a POT file
 * containing all translation keys found by the i18next-auto-keys transformer.
 */
export async function extractKeysAndGeneratePotFile(options: ExtractOptions): Promise<void> {
  const {
    source = process.cwd(),
    output,
    projectId = "app 1.0",
    include,
    exclude = ["node_modules/**", "dist/**", "build/**"],
  } = options;

  console.log(`🔍 Scanning for translation keys using patterns: ${include.join(", ")}`);
  console.log(`📁 Search root: ${source}`);

  // Clear the global store for each run (transformer uses the global store)
  i18nStore.clear();

  // Find TypeScript config
  const tsconfigPath = options.tsconfig || findTsConfig(source);
  const compilerOptions = loadTsConfig(tsconfigPath);

  // Find source files to process
  const sourceFiles = findSourceFiles(source, include, exclude);
  console.log(`📁 Found ${sourceFiles.length} source files`);

  if (sourceFiles.length === 0) {
    console.warn("⚠️  No source files found matching the criteria");
    return;
  }

  // Process each source file with the transformer
  const transformer = createI18nextAutoKeyTransformerFactory({
    hashLength: 10,
    argMode: "named",
  });

  for (const filePath of sourceFiles) {
    await processSourceFile(filePath, transformer, compilerOptions);
  }

  // Get collected translations
  const entries = Array.from(i18nStore.all().values()).sort((a: any, b: any) => a.id.localeCompare(b.id));
  console.log(`🔑 Collected ${entries.length} translation keys`);

  if (entries.length === 0) {
    console.warn("⚠️  No translation keys found in source files");
    return;
  }

  // Generate POT file
  await generatePot(entries, output, projectId);
  console.log(`✅ POT file generated: ${output}`);
}

function findTsConfig(sourceDir: string): string | undefined {
  let currentDir = path.resolve(sourceDir);

  while (currentDir !== path.dirname(currentDir)) {
    const tsconfigPath = path.join(currentDir, "tsconfig.json");
    if (fs.existsSync(tsconfigPath)) {
      return tsconfigPath;
    }
    currentDir = path.dirname(currentDir);
  }

  return undefined;
}

function loadTsConfig(tsconfigPath?: string): ts.CompilerOptions {
  if (!tsconfigPath || !fs.existsSync(tsconfigPath)) {
    return {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: true,
      skipLibCheck: true,
    };
  }

  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    console.warn(`⚠️  Error reading tsconfig.json: ${configFile.error.messageText}`);
    return {};
  }

  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(tsconfigPath));

  return parsedConfig.options;
}

function findSourceFiles(sourceDir: string, include: string[], exclude: string[]): string[] {
  const files: string[] = [];

  for (const pattern of include) {
    const matches = globSync(pattern, {
      cwd: sourceDir,
      absolute: true,
      ignore: exclude,
    });
    files.push(...matches);
  }

  // Remove duplicates
  return [...new Set(files)];
}

async function processSourceFile(
  filePath: string,
  transformer: ts.TransformerFactory<ts.SourceFile>,
  compilerOptions: ts.CompilerOptions
): Promise<void> {
  try {
    const sourceCode = fs.readFileSync(filePath, "utf8");

    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      compilerOptions.target || ts.ScriptTarget.ES2020,
      true // setParentNodes
    );

    // Apply the transformer to collect translation keys
    const result = ts.transform(sourceFile, [transformer]);
    result.dispose();
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
  }
}

async function generatePot(
  entries: Array<{ id: string; source: string; refs: Set<string>; extractedComments: Set<string> }>,
  outputPath: string,
  projectId: string
): Promise<void> {
  const parser = await loadGettextParser();
  if (!parser?.po?.compile) {
    throw new Error("gettext-parser is required to generate POT files. Install it with: npm install gettext-parser");
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const catalog = {
    charset: "utf-8",
    headers: {
      "project-id-version": projectId,
      "mime-version": "1.0",
      "content-type": "text/plain; charset=UTF-8",
      "content-transfer-encoding": "8bit",
      "plural-forms": "nplurals=1; plural=0", // we don't want to use POT format for plural forms
      "x-generator": "i18next-auto-keys CLI",
      language: "", // empty in POT templates
    },
    translations: { "": {} } as GetTextTranslationRecord,
  };

  for (const entry of entries) {
    catalog.translations[""][entry.source] = {
      msgid: entry.source,
      msgctxt: entry.id,
      msgstr: [""],
      comments: {
        reference: Array.from(entry.refs).sort().join("\n") || undefined, // "#: file:line:column"
        extracted: Array.from(entry.extractedComments).sort().join("\n") || undefined, // "#. comment"
      },
    };
  }

  const potBuffer = parser.po.compile(catalog, { sort: true });
  fs.writeFileSync(outputPath, potBuffer);
}
