// plugins/i18nextAutoKeyRollupPlugin.ts
import type { Plugin, PluginContext } from "rollup";
import ts from "typescript";
import MagicString from "magic-string";
import { i18nStore } from "../common/i18nStore";
import { loadConfig } from "../common/config/loadConfig";
import {
  shouldTransformNode,
  generateMessageId,
  recordMessage,
  extractTranslationContext,
} from "../common/messageProcessor";
import { stringPool } from "../common/stringPool";

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
 * Rollup/Vite plugin for i18next-auto-keys.
 *
 * This plugin works with both Rollup and Vite because:
 * - Vite's plugin API is a superset of Rollup's plugin API
 * - We use only the common hooks (buildStart, transform, generateBundle)
 * - In Vite dev mode, transform still works (though buildStart/generateBundle are build-only)
 *
 * ## Source Map Support
 *
 * The plugin uses **magic-string** to track text transformations and generate accurate source maps.
 * This provides:
 * - High-fidelity line and column mappings
 * - Proper handling of injected imports
 * - Accurate multi-line expression tracking
 * - Original source content preservation
 *
 * Source maps work seamlessly with debuggers and error reporting tools.
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

    transform(code, id) {
      if (!matchesInclude(pluginOptions.include, id)) return null;
      if (!id.endsWith(".ts") && !id.endsWith(".tsx")) return null;

      const sf = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, /*setParentNodes*/ true);
      const s = new MagicString(code);
      const printer = ts.createPrinter({ removeComments: false });
      const f = ts.factory;

      let didRewrite = false;
      const hadI18nextImport = /\bimport\s+i18next\b/.test(code);

      // Global store for tracking seen strings and their hashes
      const globalStore: {
        seen: Map<string, string>;
        reverse: Map<string, string>;
      } = {
        seen: new Map(),
        reverse: new Map(),
      };

      function printExpr(expr: ts.Expression): string {
        return printer.printNode(ts.EmitHint.Unspecified, expr, sf);
      }

      // Build args expression for i18next.t()
      function buildArgsExpr(params: readonly ts.ParameterDeclaration[]): ts.Expression | undefined {
        if (params.length === 0) return undefined;

        if (pluginOptions.argMode === "indexed") {
          const indexedProps: ts.PropertyAssignment[] = [];
          params.forEach((p, index) => {
            if (ts.isIdentifier(p.name)) {
              const key = f.createStringLiteral(index.toString());
              const value = f.createIdentifier(p.name.text);
              indexedProps.push(f.createPropertyAssignment(key, value));
            }
          });
          if (indexedProps.length === 0) return undefined;
          return f.createObjectLiteralExpression(indexedProps, true);
        }

        // "named"
        const namedProps: ts.ShorthandPropertyAssignment[] = [];
        for (const p of params) {
          if (ts.isIdentifier(p.name)) {
            namedProps.push(f.createShorthandPropertyAssignment(p.name));
          }
        }
        if (namedProps.length === 0) return undefined;
        return f.createObjectLiteralExpression(namedProps, true);
      }

      // Create i18next.t() call
      function makeI18nextCall(
        hashId: string,
        argsExpr?: ts.Expression,
        originalString?: string
      ): ts.Expression {
        const i18nextIdent = f.createIdentifier("i18next");
        const tAccess = f.createPropertyAccessExpression(i18nextIdent, "t");
        const callArgs: ts.Expression[] = [f.createStringLiteral(hashId)];

        // If we need to set defaultValue or have other arguments, create an options object
        if ((pluginOptions.setDefaultValue && originalString) || argsExpr) {
          let optionsExpr: ts.Expression;

          if (argsExpr && ts.isObjectLiteralExpression(argsExpr)) {
            const properties = [...argsExpr.properties];
            if (pluginOptions.setDefaultValue && originalString) {
              const defaultValueProp = f.createPropertyAssignment(
                f.createIdentifier("defaultValue"),
                f.createStringLiteral(originalString)
              );
              properties.unshift(defaultValueProp);
            }
            optionsExpr = f.createObjectLiteralExpression(properties, true);
          } else {
            const properties: ts.ObjectLiteralElementLike[] = [];
            if (pluginOptions.setDefaultValue && originalString) {
              properties.push(
                f.createPropertyAssignment(f.createIdentifier("defaultValue"), f.createStringLiteral(originalString))
              );
            }
            optionsExpr = f.createObjectLiteralExpression(properties, true);
          }

          callArgs.push(optionsExpr);
        } else if (argsExpr) {
          callArgs.push(argsExpr);
        }

        const call = f.createCallExpression(tAccess, undefined, callArgs);

        // If debug mode is enabled, wrap the call
        if (pluginOptions.debug) {
          return f.createTemplateExpression(f.createTemplateHead("~~"), [
            f.createTemplateSpan(call, f.createTemplateTail("~~")),
          ]);
        }

        return call;
      }

      function visit(node: ts.Node): void {
        // Handle PropertyAssignment with ArrowFunction/FunctionExpression
        if (
          ts.isPropertyAssignment(node) &&
          (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
        ) {
          const fn = node.initializer;

          const original = shouldTransformNode(node, fn, sf);
          if (original !== null) {
            // Extract translation context from JSDoc
            const translationContext = extractTranslationContext(node, fn, sf);

            // Generate unique message ID using shared core logic
            const id = generateMessageId(original, translationContext, globalStore, config.hashLength);

            // Intern the string after generating the hash
            const internedOriginal = stringPool.intern(original);

            // Record the message in the i18n store using shared core logic
            recordMessage(id, internedOriginal, translationContext, sf, node, fn);

            // Build new expression
            const argsExpr = buildArgsExpr(fn.parameters);
            const newExpr = makeI18nextCall(id, argsExpr, internedOriginal);

            // Replace the appropriate span
            if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) {
              // Arrow function with expression body: () => "string"
              const bodyStart = fn.body.getStart(sf);
              const bodyEnd = fn.body.getEnd();
              s.overwrite(bodyStart, bodyEnd, printExpr(newExpr));
              didRewrite = true;
            } else {
              // Block body: find return statement
              const body = fn.body;
              if (body && ts.isBlock(body) && body.statements.length === 1) {
                const st = body.statements[0];
                if (ts.isReturnStatement(st) && st.expression) {
                  const exprStart = st.expression.getStart(sf);
                  const exprEnd = st.expression.getEnd();
                  s.overwrite(exprStart, exprEnd, printExpr(newExpr));
                  didRewrite = true;
                }
              }
            }
          }
        }

        // Handle MethodDeclaration
        if (ts.isMethodDeclaration(node) && node.body) {
          const original = shouldTransformNode(node, node, sf);
          if (original !== null) {
            // Extract translation context from JSDoc
            const translationContext = extractTranslationContext(node, node, sf);

            // Generate unique message ID using shared core logic
            const id = generateMessageId(original, translationContext, globalStore, config.hashLength);

            // Intern the string after generating the hash
            const internedOriginal = stringPool.intern(original);

            // Record the message in the i18n store using shared core logic
            recordMessage(id, internedOriginal, translationContext, sf, node, node);

            // Build new expression
            const argsExpr = buildArgsExpr(node.parameters);
            const newExpr = makeI18nextCall(id, argsExpr, internedOriginal);

            // Replace return expression
            const body = node.body;
            if (body && ts.isBlock(body) && body.statements.length === 1) {
              const st = body.statements[0];
              if (ts.isReturnStatement(st) && st.expression) {
                const exprStart = st.expression.getStart(sf);
                const exprEnd = st.expression.getEnd();
                s.overwrite(exprStart, exprEnd, printExpr(newExpr));
                didRewrite = true;
              }
            }
          }
        }

        ts.forEachChild(node, visit);
      }

      visit(sf);

      // Inject import if needed
      if (didRewrite && !hadI18nextImport) {
        const insertPos = sf.statements.length ? sf.statements[0].getFullStart() : 0;
        const nl = code.includes("\r\n") ? "\r\n" : "\n";
        s.appendLeft(insertPos, `import i18next from "i18next";${nl}`);
      }

      if (!didRewrite) return null;

      return {
        code: s.toString(),
        map: s.generateMap({
          hires: true,
          includeContent: true,
          source: id,
        }),
      };
    },

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
