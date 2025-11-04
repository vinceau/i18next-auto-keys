#!/usr/bin/env node
import { Command } from "commander";
import { generatePotFile } from "./generate/generate";
import { updatePoFiles } from "./update/update";
import { convertPoToJson, convertMultiplePoToJson } from "./convert/convert";

const program = new Command();
program
  .name("i18next-auto-keys")
  .description("CLI tools for i18next-auto-keys translation workflow")
  .version("1.0.0");

// Generate POT command
program
  .command("generate")
  .description("Generate POT files from i18next-auto-keys sources")
  .option("-s, --source <path>", "Source directory to scan for translation keys (default: current directory)")
  .requiredOption("-o, --output <path>", "Output path for the POT file")
  .option("-p, --project-id <id>", "Project ID for POT header", "app 1.0")
  .requiredOption("-i, --include <patterns...>", "File patterns to include")
  .option("-e, --exclude <patterns...>", "File patterns to exclude", ["node_modules/**", "dist/**", "build/**"])
  .option("-t, --tsconfig <path>", "Path to tsconfig.json file")
  .action(async (options) => {
    try {
      await generatePotFile({
        source: options.source,
        output: options.output,
        projectId: options.projectId,
        include: options.include,
        exclude: options.exclude,
        tsconfig: options.tsconfig,
      });
    } catch (error) {
      console.error("❌ Error generating POT file:", error);
      process.exit(1);
    }
  });

// Update PO files command
program
  .command("update")
  .description("Update .po files with new strings from POT template")
  .requiredOption("-t, --template <path>", "POT template file path")
  .requiredOption("-p, --po-files <patterns...>", "PO file patterns to update")
  .option("-b, --backup", "Create backup files before updating")
  .action(async (options) => {
    try {
      await updatePoFiles({
        template: options.template,
        poFiles: options.poFiles,
        backup: options.backup,
      });
    } catch (error) {
      console.error("❌ Error updating PO files:", error);
      process.exit(1);
    }
  });

// Convert PO to JSON command
program
  .command("convert")
  .description("Convert .po files to i18next compatible JSON format")
  .requiredOption("-i, --input <path>", "Input .po file path or glob pattern for multiple files")
  .requiredOption("-o, --output <path>", "Output JSON file path (for single file) or output directory (for multiple files)")
  .option("-t, --top-level-key <key>", "Wrap translations under a top-level key (matches emit plugin)")
  .option("--indent <number>", "JSON indentation spaces", "2")
  .option("--batch", "Batch mode: treat input as glob pattern and output as directory")
  .action(async (options) => {
    try {
      const indent = parseInt(options.indent?.toString() || "2", 10);
      
      if (options.batch) {
        await convertMultiplePoToJson({
          pattern: options.input,
          outputDir: options.output,
          topLevelKey: options.topLevelKey,
          indent,
        });
      } else {
        await convertPoToJson({
          input: options.input,
          output: options.output,
          topLevelKey: options.topLevelKey,
          indent,
        });
      }
    } catch (error) {
      console.error("❌ Error converting .po to JSON:", error);
      process.exit(1);
    }
  });

if (require.main === module) {
  program.parse(process.argv);
}

export { program };
