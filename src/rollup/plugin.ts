// plugins/i18nextAutoKeyRollupPlugin.ts
import type { Plugin, PluginContext } from "rollup";
import ts from "typescript";
import { SourceMapGenerator } from "source-map";
import { createI18nextAutoKeyTransformerFactory } from "../transformer/transformer";
import { i18nStore } from "../common/i18nStore";
import { loadConfig } from "../common/config/loadConfig";

export type I18nextAutoKeyRollupPluginOptions = {
  /** Pattern(s) to match files for processing. Defaults to /\.messages\.(ts|tsx)$/ */
  include?: RegExp | RegExp[];
  /** How to pass runtime args into i18next.t */
  argMode?: "indexed" | "named";
  /** Whether to include the original string as defaultValue in i18next.t calls */
  setDefaultValue?: boolean;
  /** Wrap transformed strings with "~~" markers for visual debugging in development */
  debug?: boolean;
  /** Path where the runtime JSON should be emitted (e.g. "locales/en.json"). */
  jsonOutputPath: string;
  /** Optional top level key to wrap translations under. If undefined, translations are placed at root level. */
  topLevelKey?: string;
};

function matchesInclude(include: RegExp | RegExp[] | undefined, id: string): boolean {
  if (!include) {
    // Default pattern if none provided
    return /\.messages\.(ts|tsx)$/.test(id);
  }
  const arr = Array.isArray(include) ? include : [include];
  return arr.some((re) => re.test(id));
}

/**
 * Generate a source map for the transformed code.
 *
 * IMPORTANT LIMITATIONS:
 * This is an APPROXIMATE source map that handles basic cases but has known limitations:
 * 1. Accounts for the injected i18next import (if present)
 * 2. Assumes mostly 1:1 line mappings for the rest
 * 3. Does NOT accurately handle:
 *    - Multi-line expressions that get collapsed
 *    - Significant whitespace changes
 *    - Complex AST transformations
 *
 * For perfect source maps, we would need to use a library like magic-string
 * to track actual text transformations, but that's incompatible with
 * TypeScript's AST-based approach.
 *
 * This approximate mapping is still useful for:
 * - Basic debugging
 * - Getting close to the right line when errors occur
 * - Better than no source map for simple transformations
 */
function generateSourceMap(
  originalCode: string,
  transformedCode: string,
  fileName: string,
  importWasInjected: boolean
) {
  const generator = new SourceMapGenerator({
    file: fileName,
  });

  // Add the source file
  generator.setSourceContent(fileName, originalCode);

  const transformedLines = transformedCode.split("\n");
  const originalLines = originalCode.split("\n");

  // If we injected an import, it's at line 1, so we need to offset
  const importLineCount = importWasInjected ? 1 : 0;

  transformedLines.forEach((line, transformedIndex) => {
    if (line.trim().length === 0) return; // Skip empty lines

    // Handle the injected import line specially
    if (importWasInjected && transformedIndex === 0 && line.includes('import i18next')) {
      // Map the import line to the first line of original file
      // (it doesn't really exist in original, but this is the best we can do)
      generator.addMapping({
        source: fileName,
        original: { line: 1, column: 0 },
        generated: { line: 1, column: 0 },
      });
      return;
    }

    // For other lines, offset by the number of injected lines
    const originalIndex = transformedIndex - importLineCount;

    // Ensure we don't go out of bounds
    if (originalIndex >= 0 && originalIndex < originalLines.length) {
      generator.addMapping({
        source: fileName,
        original: { line: originalIndex + 1, column: 0 }, // source-map uses 1-based lines
        generated: { line: transformedIndex + 1, column: 0 },
      });
    }
  });

  return generator.toJSON();
}

/**
 * Rollup/Vite plugin for i18next-auto-keys.
 *
 * This plugin works with both Rollup and Vite because:
 * - Vite's plugin API is a superset of Rollup's plugin API
 * - We use only the common hooks (buildStart, transform, generateBundle)
 * - In Vite dev mode, transform still works (though buildStart/generateBundle are build-only)
 *
 * ## Source Map Support
 *
 * The plugin generates source maps with the following characteristics:
 * - Accounts for injected i18next imports
 * - Provides approximate line-to-line mappings
 * - Useful for basic debugging and error tracking
 *
 * **Known Limitations:**
 * - Multi-line expressions that get collapsed may not map perfectly
 * - Significant whitespace changes are not tracked
 * - Column-level mappings are not provided (line-level only)
 *
 * These limitations are inherent to using TypeScript's AST transformation API,
 * which doesn't provide detailed source position tracking during code generation.
 * For most use cases, the approximate mappings are sufficient for debugging.
 *
 * @example Rollup
 * ```js
 * // rollup.config.js
 * import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys/rollup';
 *
 * export default {
 *   plugins: [
 *     i18nextAutoKeyRollupPlugin({
 *       jsonOutputPath: 'locales/en.json',
 *     })
 *   ]
 * };
 * ```
 *
 * @example Vite
 * ```js
 * // vite.config.js
 * import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys/rollup';
 *
 * export default {
 *   plugins: [
 *     i18nextAutoKeyRollupPlugin({
 *       jsonOutputPath: 'locales/en.json',
 *       setDefaultValue: process.env.NODE_ENV === 'development',
 *     })
 *   ]
 * };
 * ```
 */
export function i18nextAutoKeyRollupPlugin(options: I18nextAutoKeyRollupPluginOptions): Plugin {
  const { config, file: configFile } = loadConfig();

  const pluginOptions = {
    include: options.include,
    argMode: options.argMode ?? config.argMode,
    setDefaultValue: options.setDefaultValue ?? false,
    debug: options.debug ?? false,
    jsonOutputPath: options.jsonOutputPath,
    topLevelKey: options.topLevelKey ?? config.topLevelKey,
  };

  return {
    name: "i18next-auto-keys",

    // Watch the config file for changes (works in both Rollup and Vite)
    buildStart() {
      // Clear the store at the start of each build
      i18nStore.clear();

      // Add config file as a dependency so changes trigger rebuilds
      if (configFile) {
        this.addWatchFile(configFile);
      }
    },

    // Transform TypeScript files (works in both Rollup and Vite, including Vite dev mode)
    transform(code: string, id: string) {
      // Skip if file doesn't match include pattern
      if (!matchesInclude(pluginOptions.include, id)) {
        return null;
      }

      // Skip non-TypeScript files
      if (!id.endsWith(".ts") && !id.endsWith(".tsx")) {
        return null;
      }

      try {
        // Create TypeScript source file
        const sourceFile = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true);

        // Check if original file has i18next import
        const hadI18nextImport = code.includes('import i18next');

        // Apply the transformer
        const transformer = createI18nextAutoKeyTransformerFactory({
          hashLength: config.hashLength,
          argMode: pluginOptions.argMode,
          setDefaultValue: pluginOptions.setDefaultValue,
          debug: pluginOptions.debug,
        });

        const result = ts.transform(sourceFile, [transformer]);
        const transformedFile = result.transformed[0] as ts.SourceFile;

        // Print the transformed code
        const printer = ts.createPrinter();
        const transformedCode = printer.printFile(transformedFile);

        result.dispose();

        // Check if transformer injected an import
        const hasI18nextImport = transformedCode.includes('import i18next');
        const importWasInjected = hasI18nextImport && !hadI18nextImport;

        // Generate source map (with limitations - see function documentation)
        const map = generateSourceMap(code, transformedCode, id, importWasInjected);

        return {
          code: transformedCode,
          map,
        };
      } catch (error) {
        this.error(`Failed to transform ${id}: ${error}`);
        return null;
      }
    },

    // Emit JSON file with collected translations (works in both Rollup and Vite build)
    generateBundle() {
      // Build a stable snapshot of entries
      const entries = Array.from(i18nStore.all().values()).sort((a, b) => a.id.localeCompare(b.id));

      // Build dictionary
      const dict: Record<string, string> = {};
      for (const e of entries) {
        dict[e.id] = e.source;
      }

      // Optionally wrap under topLevelKey
      const finalOutput = pluginOptions.topLevelKey ? { [pluginOptions.topLevelKey]: dict } : dict;

      // Create JSON content
      const jsonContent = JSON.stringify(finalOutput, null, config.jsonIndentSpaces);

      // Emit as an asset
      this.emitFile({
        type: "asset",
        fileName: pluginOptions.jsonOutputPath,
        source: jsonContent,
      });
    },
  };
}

