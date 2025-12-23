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
 * Since our transformer preserves most of the source structure via ts.setTextRange,
 * we generate a source map that maps each line from output back to the input.
 */
function generateSourceMap(originalCode: string, transformedCode: string, fileName: string) {
  const generator = new SourceMapGenerator({
    file: fileName,
  });

  // Add the source file
  generator.setSourceContent(fileName, originalCode);

  // Split both codes into lines
  const originalLines = originalCode.split("\n");
  const transformedLines = transformedCode.split("\n");

  // Create a simple line-to-line mapping
  // This works because TypeScript's printer preserves structure and our transformer
  // uses ts.setTextRange to maintain source positions
  transformedLines.forEach((line, index) => {
    if (line.trim().length > 0) {
      // Map each line in the transformed code back to the corresponding line in the original
      // We use a simple 1:1 mapping since the transformation preserves structure
      const originalLine = Math.min(index, originalLines.length - 1);

      generator.addMapping({
        source: fileName,
        original: { line: originalLine + 1, column: 0 }, // source-map uses 1-based lines
        generated: { line: index + 1, column: 0 },
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

        // Generate source map
        // Since our transformer preserves most of the source structure via ts.setTextRange,
        // we generate a source map that maps each line from output back to the input.
        const map = generateSourceMap(code, transformedCode, id);

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

