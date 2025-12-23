// plugins/i18nextAutoKeyRollupPlugin.ts
import type { Plugin, PluginContext } from "rollup";
import ts from "typescript";
import MagicString from "magic-string";
import { i18nStore, toRelPosix } from "../common/i18nStore";
import { loadConfig } from "../common/config/loadConfig";
import { stableHash } from "../common/hash";
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

// Helper: Check for @noTranslate JSDoc tag
function hasNoTranslateTag(node: ts.Node, sf: ts.SourceFile): boolean {
  const TAG = "noTranslate";
  const anyTs: any = ts as any;

  // 1) Modern helper if present
  if (typeof anyTs.getJSDocTags === "function") {
    try {
      const tags: readonly ts.JSDocTag[] = anyTs.getJSDocTags(node);
      if (
        tags?.some((t: any) => {
          const name = (t.tagName?.escapedText ?? t.tagName?.getText?.(sf)) as string | undefined;
          return name === TAG;
        })
      )
        return true;
    } catch {
      /* ignore */
    }
  }

  // 2) Legacy: node.jsDoc
  const jsDocs = (node as any).jsDoc as readonly ts.JSDoc[] | undefined;
  if (jsDocs) {
    for (const d of jsDocs) {
      const tags = d.tags;
      if (tags) {
        for (const tg of tags) {
          const name = (tg.tagName as any)?.escapedText ?? (tg.tagName as any)?.getText?.(sf);
          if (name === TAG) return true;
        }
      }
      if (typeof d.comment === "string" && /@noTranslate\b/.test(d.comment)) return true;
    }
  }

  // 3) Fallback: scan leading comments
  const text = sf.getFullText();
  const ranges = ts.getLeadingCommentRanges?.(text, node.getFullStart());
  if (ranges) {
    for (const r of ranges) {
      const comment = text.slice(r.pos, r.end);
      if (/@noTranslate\b/.test(comment)) return true;
    }
  }
  return false;
}

// Helper: Extract string literal from function return
function evaluateStringConcat(expr: ts.Expression): string | null {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.text;
  }
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = evaluateStringConcat(expr.left);
    const right = evaluateStringConcat(expr.right);
    if (left != null && right != null) return left + right;
  }
  return null;
}

function extractReturnStringLiteral(
  fn: ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration
): string | null {
  const body = fn.body;
  if (!body) return null;

  if (ts.isStringLiteral(body) || ts.isNoSubstitutionTemplateLiteral(body) || ts.isBinaryExpression(body)) {
    return evaluateStringConcat(body);
  }
  if (ts.isBlock(body)) {
    const stmts = body.statements;
    if (stmts.length === 1 && ts.isReturnStatement(stmts[0])) {
      const ret = stmts[0].expression;
      if (ret) return evaluateStringConcat(ret);
    }
  }
  return null;
}

// Helper: Collect leading comments
function getLeadingComments(sf: ts.SourceFile, node: ts.Node): string[] {
  const text = sf.getFullText();
  const ranges = ts.getLeadingCommentRanges?.(text, node.getFullStart()) || [];
  const out: string[] = [];
  for (const r of ranges) {
    const raw = text.slice(r.pos, r.end);
    if (raw.startsWith("//")) {
      out.push(raw.replace(/^\/\/\s?/, "").trim());
    } else if (raw.startsWith("/*")) {
      out.push(
        raw
          .replace(/^\/\*+|\*+\/$/g, "")
          .split("\n")
          .map((s) => s.trim())
          .join(" ")
          .trim()
      );
    }
  }
  return out.filter(Boolean);
}

// Helper: Extract @translationContext from JSDoc
function extractTranslationContext(
  containerNode: ts.PropertyAssignment | ts.MethodDeclaration,
  fn: ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration,
  sf: ts.SourceFile
): string | undefined {
  const text = sf.getFullText();
  let ranges: readonly ts.CommentRange[] = [];

  const functionRanges = ts.getLeadingCommentRanges?.(text, fn.getFullStart()) || [];
  ranges = [...functionRanges];

  const containerRanges = ts.getLeadingCommentRanges?.(text, containerNode.getFullStart()) || [];
  for (const cRange of containerRanges) {
    const overlaps = functionRanges.some(
      (fRange) =>
        (cRange.pos >= fRange.pos && cRange.pos <= fRange.end) || (cRange.end >= fRange.pos && cRange.end <= fRange.end)
    );
    if (!overlaps) {
      ranges = [...ranges, cRange];
    }
  }

  for (const r of ranges) {
    const raw = text.slice(r.pos, r.end);
    if (raw.startsWith("/**")) {
      const lines = raw.split("\n");
      for (const line of lines) {
        if (line.includes("@translationContext")) {
          const match = line.match(/@translationContext\s+(.+)/);
          if (match) {
            let context = match[1];
            context = context
              .replace(/\*\/\s*$/, "")
              .replace(/\*\s*$/, "")
              .trim();
            if (context) return context;
          }
        }
      }
    }
  }
  return undefined;
}

// Helper: Get anchor node for better source references
function anchorForMessageNode(
  fn: ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration
): ts.Node | undefined {
  const body = fn.body;
  if (!body) return fn;

  if (ts.isStringLiteral(body) || ts.isNoSubstitutionTemplateLiteral(body) || ts.isBinaryExpression(body)) {
    return body;
  }
  if (ts.isBlock(body)) {
    const stmts = body.statements;
    if (stmts.length === 1 && ts.isReturnStatement(stmts[0]) && stmts[0].expression) {
      const ret = stmts[0].expression!;
      if (ts.isStringLiteral(ret) || ts.isNoSubstitutionTemplateLiteral(ret) || ts.isBinaryExpression(ret)) {
        return ret;
      }
      return ret;
    }
  }
  return fn;
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

          // Skip if @noTranslate
          if (hasNoTranslateTag(node, sf) || hasNoTranslateTag(fn, sf)) {
            ts.forEachChild(node, visit);
            return;
          }

          const original = extractReturnStringLiteral(fn);
          if (original !== null) {
            const internedOriginal = stringPool.intern(original);
            const translationContext = extractTranslationContext(node, fn, sf);
            const compositeKey = translationContext ? `${internedOriginal}::${translationContext}` : internedOriginal;

            // Compute or reuse hash
            let id = globalStore.reverse.get(compositeKey);
            if (!id) {
              id = stableHash(internedOriginal, { context: translationContext, hashLength: config.hashLength });
              while (globalStore.seen.has(id) && globalStore.seen.get(id) !== compositeKey) {
                id = stableHash(compositeKey + ":" + id, { hashLength: Math.min(40, config.hashLength + 2) });
              }
              globalStore.seen.set(id, compositeKey);
              globalStore.reverse.set(compositeKey, id);
            }

            // Record in i18nStore
            const anchor = anchorForMessageNode(fn) ?? node;
            const start = sf.getLineAndCharacterOfPosition(anchor.getStart(sf));
            const rel = toRelPosix(sf.fileName);
            const comments = [
              ...getLeadingComments(sf, node),
              ...(anchor !== node ? getLeadingComments(sf, anchor) : []),
            ];

            i18nStore.add({
              id,
              source: internedOriginal,
              translationContext,
              ref: { file: rel, line: start.line + 1, column: start.character + 1 },
              comments,
            });

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
          if (hasNoTranslateTag(node, sf)) {
            ts.forEachChild(node, visit);
            return;
          }

          const original = extractReturnStringLiteral(node);
          if (original !== null) {
            const internedOriginal = stringPool.intern(original);
            const translationContext = extractTranslationContext(node, node, sf);
            const compositeKey = translationContext ? `${internedOriginal}::${translationContext}` : internedOriginal;

            // Compute or reuse hash
            let id = globalStore.reverse.get(compositeKey);
            if (!id) {
              id = stableHash(internedOriginal, { context: translationContext, hashLength: config.hashLength });
              while (globalStore.seen.has(id) && globalStore.seen.get(id) !== compositeKey) {
                id = stableHash(compositeKey + ":" + id, { hashLength: Math.min(40, config.hashLength + 2) });
              }
              globalStore.seen.set(id, compositeKey);
              globalStore.reverse.set(compositeKey, id);
            }

            // Record in i18nStore
            const anchor = anchorForMessageNode(node) ?? node;
            const start = sf.getLineAndCharacterOfPosition(anchor.getStart(sf));
            const rel = toRelPosix(sf.fileName);
            const comments = [
              ...getLeadingComments(sf, node),
              ...(anchor !== node ? getLeadingComments(sf, anchor) : []),
            ];

            i18nStore.add({
              id,
              source: internedOriginal,
              translationContext,
              ref: { file: rel, line: start.line + 1, column: start.character + 1 },
              comments,
            });

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
