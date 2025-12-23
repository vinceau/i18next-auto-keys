// src/transformer/core.ts
/**
 * Unified transformer core for i18next-auto-keys.
 * 
 * This module provides a single, unified transformation implementation that:
 * - Uses MagicString for precise source map generation
 * - Uses TypeScript only for AST analysis (not code generation)
 * - Works seamlessly with both Rollup/Vite and Webpack
 * - Eliminates ALL code duplication between bundler integrations
 * 
 * @example
 * ```ts
 * const result = transformMessages(code, filename, {
 *   argMode: 'named',
 *   setDefaultValue: true,
 *   debug: false,
 *   hashLength: 10
 * });
 * 
 * if (result.didTransform) {
 *   return { code: result.code, map: result.map };
 * }
 * ```
 */

import ts from "typescript";
import MagicString from "magic-string";
import { i18nStore } from "../common/i18nStore";
import { stringPool } from "../common/stringPool";
import {
  shouldTransformNode,
  generateMessageId,
  recordMessage,
  extractTranslationContext,
} from "./transformHelpers";

export type TransformOptions = {
  /** How to pass runtime args into i18next.t */
  argMode: "indexed" | "named";
  /** Whether to include the original string as defaultValue in i18next.t calls */
  setDefaultValue: boolean;
  /** Wrap transformed strings with "~~" markers for visual debugging in development */
  debug: boolean;
  /** Length of generated hash IDs */
  hashLength: number;
};

export type TransformResult = {
  /** Transformed code */
  code: string;
  /** Source map object (compatible with both Rollup and Webpack) */
  map: any;
  /** Whether any transformations were made */
  didTransform: boolean;
};

/**
 * Global store for tracking seen strings and their hashes within a single transformation.
 * This ensures consistent hash generation across multiple message functions.
 */
type GlobalStore = {
  seen: Map<string, string>;
  reverse: Map<string, string>;
};

/**
 * Core transformation function that processes i18n message files.
 * 
 * This function:
 * 1. Parses the TypeScript/JavaScript code into an AST
 * 2. Identifies transformable message functions
 * 3. Generates stable hash IDs for each message
 * 4. Rewrites functions to i18next.t() calls using MagicString
 * 5. Injects i18next import if needed
 * 6. Generates accurate source maps
 * 
 * @param code - Source code to transform
 * @param filename - File path (for source maps and error reporting)
 * @param options - Transformation options
 * @returns TransformResult with code, source map, and transformation status
 */
export function transformMessages(
  code: string,
  filename: string,
  options: TransformOptions
): TransformResult {
  // Parse source file for AST analysis
  // Note: We use Latest to support all modern syntax during parsing.
  // This is safe because we only analyze the AST (not generate code).
  // The actual transpilation target is handled by the bundler (Rollup/Webpack/etc).
  const sf = ts.createSourceFile(
    filename,
    code,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true
  );

  // Initialize MagicString for tracking transformations
  const s = new MagicString(code);
  
  // TypeScript printer and factory for generating code
  const printer = ts.createPrinter({ removeComments: false });
  const f = ts.factory;

  // Track transformation state
  let didRewrite = false;
  const hadI18nextImport = /\bimport\s+i18next\b/.test(code);

  // Local store for this file's transformations
  const globalStore: GlobalStore = {
    seen: new Map(),
    reverse: new Map(),
  };

  /**
   * Print a TypeScript expression node to string.
   */
  function printExpr(expr: ts.Expression): string {
    return printer.printNode(ts.EmitHint.Unspecified, expr, sf);
  }

  /**
   * Build the args expression for i18next.t() based on function parameters.
   * Supports both "indexed" ({ "0": value }) and "named" ({ value }) modes.
   */
  function buildArgsExpr(
    params: readonly ts.ParameterDeclaration[]
  ): ts.Expression | undefined {
    if (params.length === 0) return undefined;

    if (options.argMode === "indexed") {
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

    // "named" mode
    const namedProps: ts.ShorthandPropertyAssignment[] = [];
    for (const p of params) {
      if (ts.isIdentifier(p.name)) {
        namedProps.push(f.createShorthandPropertyAssignment(p.name));
      }
    }
    if (namedProps.length === 0) return undefined;
    return f.createObjectLiteralExpression(namedProps, true);
  }

  /**
   * Create an i18next.t() call expression.
   * Optionally includes defaultValue and debug markers.
   */
  function makeI18nextCall(
    hashId: string,
    argsExpr?: ts.Expression,
    originalString?: string
  ): ts.Expression {
    const i18nextIdent = f.createIdentifier("i18next");
    const tAccess = f.createPropertyAccessExpression(i18nextIdent, "t");
    const callArgs: ts.Expression[] = [f.createStringLiteral(hashId)];

    // Build options object if needed (for args or defaultValue)
    if ((options.setDefaultValue && originalString) || argsExpr) {
      let optionsExpr: ts.Expression;

      if (argsExpr && ts.isObjectLiteralExpression(argsExpr)) {
        const properties = [...argsExpr.properties];
        if (options.setDefaultValue && originalString) {
          const defaultValueProp = f.createPropertyAssignment(
            f.createIdentifier("defaultValue"),
            f.createStringLiteral(originalString)
          );
          properties.unshift(defaultValueProp);
        }
        optionsExpr = f.createObjectLiteralExpression(properties, true);
      } else {
        const properties: ts.ObjectLiteralElementLike[] = [];
        if (options.setDefaultValue && originalString) {
          properties.push(
            f.createPropertyAssignment(
              f.createIdentifier("defaultValue"),
              f.createStringLiteral(originalString)
            )
          );
        }
        optionsExpr = f.createObjectLiteralExpression(properties, true);
      }

      callArgs.push(optionsExpr);
    } else if (argsExpr) {
      callArgs.push(argsExpr);
    }

    const call = f.createCallExpression(tAccess, undefined, callArgs);

    // Wrap in debug markers if enabled
    if (options.debug) {
      return f.createTemplateExpression(f.createTemplateHead("~~"), [
        f.createTemplateSpan(call, f.createTemplateTail("~~")),
      ]);
    }

    return call;
  }

  /**
   * Visit all nodes in the AST and transform matching patterns.
   */
  function visit(node: ts.Node): void {
    // Pattern 1: PropertyAssignment with ArrowFunction/FunctionExpression
    // e.g., greeting: (name) => `Hello ${name}`
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))
    ) {
      const fn = node.initializer;
      const original = shouldTransformNode(node, fn, sf);
      
      if (original !== null) {
        transformFunction(node, fn, original);
      }
    }

    // Pattern 2: MethodDeclaration (shorthand syntax)
    // e.g., greeting(name) { return `Hello ${name}` }
    if (ts.isMethodDeclaration(node) && node.body) {
      const original = shouldTransformNode(node, node, sf);
      
      if (original !== null) {
        transformFunction(node, node, original);
      }
    }

    // Continue traversing
    ts.forEachChild(node, visit);
  }

  /**
   * Transform a single message function to an i18next.t() call.
   */
  function transformFunction(
    containerNode: ts.PropertyAssignment | ts.MethodDeclaration,
    fn: ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration,
    original: string
  ): void {
    // Extract translation context from JSDoc
    const translationContext = extractTranslationContext(containerNode, fn, sf);

    // Generate unique message ID using shared core logic
    const id = generateMessageId(
      original,
      translationContext,
      globalStore,
      options.hashLength
    );

    // Intern the string for memory efficiency
    const internedOriginal = stringPool.intern(original);

    // Record the message in the i18n store
    recordMessage(id, internedOriginal, translationContext, sf, containerNode, fn);

    // Build new expression
    const argsExpr = buildArgsExpr(fn.parameters);
    const newExpr = makeI18nextCall(id, argsExpr, internedOriginal);

    // Determine what to replace based on function structure
    if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) {
      // Arrow function with expression body: () => "string"
      const bodyStart = fn.body.getStart(sf);
      const bodyEnd = fn.body.getEnd();
      s.overwrite(bodyStart, bodyEnd, printExpr(newExpr));
      didRewrite = true;
    } else {
      // Block body: find and replace return statement
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

  // Start traversal
  visit(sf);

  // Inject i18next import if we made transformations and it's not already present
  if (didRewrite && !hadI18nextImport) {
    const insertPos = sf.statements.length ? sf.statements[0].getFullStart() : 0;
    const nl = code.includes("\r\n") ? "\r\n" : "\n";
    s.appendLeft(insertPos, `import i18next from "i18next";${nl}`);
  }

  // Return result
  if (!didRewrite) {
    return {
      code,
      map: null,
      didTransform: false,
    };
  }

  return {
    code: s.toString(),
    map: s.generateMap({
      hires: true,
      includeContent: true,
      source: filename,
    }),
    didTransform: true,
  };
}

