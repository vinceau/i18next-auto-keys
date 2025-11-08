#!/usr/bin/env node
import path from "path";
import { Command } from "commander";
import { extractKeysAndGeneratePotFile } from "./extract/extract";
import { syncPoFiles } from "./sync/sync";
import { convertPoToJson, convertMultiplePoToJson } from "./convert/convert";
import { showTranslationStatus } from "./status/status";
import { loadConfig } from "@/index";

// CLI Option Types - properly typed interfaces instead of relying on 'any'
interface ExtractOptions {
  include: string[];
  source?: string;
  output?: string;
  projectId?: string;
  exclude: string[];
  tsconfig?: string;
}

interface SyncOptions {
  poFiles?: string[];
  template?: string;
  backup?: boolean;
}

interface ConvertOptions {
  output: string;
  input?: string;
  topLevelKey?: string;
  indent?: string;
  batch?: boolean;
}

interface StatusOptions {
  directory: string;
  verbose?: boolean;
}

const { config } = loadConfig();

const program = new Command();
program
  .name(process.env.PACKAGE_NAME || "i18next-auto-keys")
  .description("CLI tools for i18next-auto-keys translation workflow")
  .version(process.env.PACKAGE_VERSION || "unknown");

// Extract POT command
program
  .command("extract")
  .description("Extract translation keys and generate POT files from i18next-auto-keys sources")
  .requiredOption("-i, --include <patterns...>", "File patterns to include")
  .option("-s, --source <path>", "Source directory to scan for translation keys (default: current directory)")
  .option("-o, --output <path>", "Output path for the POT file")
  .option(
    "-p, --project-id <id>",
    "Project ID for POT header (defaults to package.json name and version, fallback: 'app 1.0')"
  )
  .option("-e, --exclude <patterns...>", "File patterns to exclude", ["node_modules/**", "dist/**", "build/**"])
  .option("-t, --tsconfig <path>", "Path to tsconfig.json file")
  .action(async (options: ExtractOptions) => {
    try {
      const poTemplatePath = path.join(config.poOutputDirectory, config.poTemplateName);
      await extractKeysAndGeneratePotFile({
        source: options.source,
        output: options.output ?? poTemplatePath,
        projectId: options.projectId ?? config.projectId,
        include: options.include,
        exclude: options.exclude,
        tsconfig: options.tsconfig,
      });
    } catch (error) {
      console.error("❌ Error extracting translation keys:", error);
      process.exit(1);
    }
  });

// Sync PO files command
program
  .command("sync")
  .description("Sync .po files with new strings from PO template")
  .option("-p, --po-files <patterns...>", "PO file patterns to sync")
  .option("-t, --template <path>", "PO template file path")
  .option("-b, --backup", "Create backup files before syncing")
  .action(async (options: SyncOptions) => {
    try {
      const poTemplatePath = path.join(config.poOutputDirectory, config.poTemplateName);
      const poFilesGlob = path.join(config.poOutputDirectory, "*.po");

      await syncPoFiles({
        template: options.template ?? poTemplatePath,
        poFiles: options.poFiles ?? [poFilesGlob],
        backup: options.backup,
      });
    } catch (error) {
      console.error("❌ Error syncing PO files:", error);
      process.exit(1);
    }
  });

// Convert PO to JSON command
program
  .command("convert")
  .description("Convert .po files to i18next compatible JSON format")
  .requiredOption(
    "-o, --output <path>",
    "Output JSON file path (for single file) or output directory (for multiple files)"
  )
  .option("-i, --input <path>", "Input .po file path or glob pattern for multiple files")
  .option("-t, --top-level-key <key>", "Wrap translations under a top-level key (matches emit plugin)")
  .option("--indent <number>", "JSON indentation spaces", "2")
  .option("--batch", "Batch mode: treat input as glob pattern and output as directory")
  .action(async (options: ConvertOptions) => {
    try {
      const indent = options.indent ? parseInt(options.indent.toString(), 10) : config.jsonIndentSpaces;
      const topLevelKey = options.topLevelKey ?? config.topLevelKey;
      const poFilesGlob = path.join(config.poOutputDirectory, "*.po");

      if (options.batch) {
        await convertMultiplePoToJson({
          pattern: options.input ?? poFilesGlob,
          outputDir: options.output,
          topLevelKey,
          indent,
        });
      } else {
        if (!options.input) {
          throw new Error("Input file path is required when not using batch mode. Use -i/--input option or add --batch flag.");
        }
        await convertPoToJson({
          input: options.input,
          output: options.output,
          topLevelKey,
          indent,
        });
      }
    } catch (error) {
      console.error("❌ Error converting .po to JSON:", error);
      process.exit(1);
    }
  });

// Status command
program
  .command("status")
  .description("Show translation progress for .po files in a directory")
  .requiredOption("-d, --directory <path>", "Directory containing .po files to analyze")
  .option("-v, --verbose", "Show detailed information for each file")
  .action(async (options: StatusOptions) => {
    try {
      await showTranslationStatus({
        directory: options.directory,
        verbose: options.verbose,
      });
    } catch (error) {
      console.error("❌ Error analyzing translation status:", error);
      process.exit(1);
    }
  });

if (require.main === module) {
  program.parse(process.argv);
}

export { program };
