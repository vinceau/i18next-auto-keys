// transformers/i18nMessagesTransformer.ts
import ts from "typescript";
import { stableHash } from "../common/hash";
import { i18nStore, toRelPosix, ParameterMetadata } from "../common/i18nStore";
import { stringPool } from "../common/stringPool";

export type I18nextAutoKeyTransformerOptions = {
  hashLength?: number;
  /** How to pass runtime args into i18next.t */
  argMode?: "indexed" | "named";
  /** Whether to include the original string as defaultValue in i18next.t calls */
  setDefaultValue?: boolean;
  /** Wrap transformed strings with "~~" markers for visual debugging in development */
  debug?: boolean;
};

/** Global store for tracking seen strings and their hashes.
 * We store a mapping of string to hash and a reverse mapping of hash to string.
 * This is used to avoid duplicate ids when same string produces the same hash.
 */
const globalStore: {
  seen: Map<string, string>;
  reverse: Map<string, string>;
} = {
  seen: new Map(),
  reverse: new Map(),
};

/** Best-effort check for a `@noTranslate` jsdoc/tsdoc tag on this node. */
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

/** Collect leading comments as extracted translator notes. */
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

/** Extract JSDoc parameter information from function parameters */
function extractParameterMetadata(
  fn: ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration,
  sf: ts.SourceFile
): ParameterMetadata | undefined {
  const params = fn.parameters;
  if (params.length === 0) return undefined;

  const parameterNames: string[] = [];
  const parameterTypes: string[] = [];
  const parameterJSDoc: { [paramName: string]: string } = {};

  // Use the same method as getLeadingComments to get the JSDoc text
  const text = sf.getFullText();

  // Collect JSDoc from both the function itself AND the parent property assignment
  let ranges: readonly ts.CommentRange[] = [];

  // Try to get JSDoc from the function itself first
  const functionRanges = ts.getLeadingCommentRanges?.(text, fn.getFullStart()) || [];
  ranges = [...functionRanges];

  // Also try the parent (property assignment) if it exists, but skip for method declarations
  // since they already capture their own JSDoc
  if (!ts.isMethodDeclaration(fn) && fn.parent && ts.isPropertyAssignment(fn.parent)) {
    const parentRanges = ts.getLeadingCommentRanges?.(text, fn.parent.getFullStart()) || [];
    // Add parent ranges if they don't overlap with function ranges
    for (const pRange of parentRanges) {
      const overlaps = functionRanges.some(
        (fRange) =>
          (pRange.pos >= fRange.pos && pRange.pos <= fRange.end) ||
          (pRange.end >= fRange.pos && pRange.end <= fRange.end)
      );
      if (!overlaps) {
        ranges = [...ranges, pRange];
      }
    }
  }

  for (const r of ranges) {
    const raw = text.slice(r.pos, r.end);
    if (raw.startsWith("/**")) {
      // Simple, direct approach: look for @param lines
      const lines = raw.split("\n");
      for (const line of lines) {
        // Extremely simple regex - just find @param followed by word and description
        if (line.includes("@param")) {
          const match = line.match(/@param\s+(\w+)\s+(.+)/);
          if (match) {
            const paramName = match[1];
            let paramDescription = match[2];

            // Remove common endings
            paramDescription = paramDescription
              .replace(/\*\/\s*$/, "")
              .replace(/\*\s*$/, "")
              .trim();

            if (paramName && paramDescription) {
              parameterJSDoc[paramName] = paramDescription;
            }
          }
        }
      }
    }
  }

  for (const param of params) {
    if (ts.isIdentifier(param.name)) {
      const paramName = param.name.text;
      parameterNames.push(paramName);

      // Extract type information
      const paramType = getTypeString(param, sf);
      parameterTypes.push(paramType);
    }
  }

  return parameterNames.length > 0 ? { parameterNames, parameterTypes, parameterJSDoc } : undefined;
}

/** Extract @translationContext from JSDoc comments */
function extractTranslationContext(
  containerNode: ts.PropertyAssignment | ts.MethodDeclaration,
  fn: ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration,
  sf: ts.SourceFile
): string | undefined {
  const text = sf.getFullText();

  // Collect JSDoc from both the function itself AND the parent property assignment
  let ranges: readonly ts.CommentRange[] = [];

  // Try to get JSDoc from the function itself first
  const functionRanges = ts.getLeadingCommentRanges?.(text, fn.getFullStart()) || [];
  ranges = [...functionRanges];

  // Also try the parent (container) for property assignments and method declarations
  const containerRanges = ts.getLeadingCommentRanges?.(text, containerNode.getFullStart()) || [];
  // Add container ranges if they don't overlap with function ranges
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
      // Look for @translationContext lines
      const lines = raw.split("\n");
      for (const line of lines) {
        if (line.includes("@translationContext")) {
          const match = line.match(/@translationContext\s+(.+)/);
          if (match) {
            let context = match[1];
            // Remove common endings and clean up
            context = context
              .replace(/\*\/\s*$/, "")
              .replace(/\*\s*$/, "")
              .trim();

            if (context) {
              return context;
            }
          }
        }
      }
    }
  }

  return undefined;
}

/** Extract type information from a parameter declaration */
function getTypeString(param: ts.ParameterDeclaration, sf: ts.SourceFile): string {
  if (param.type) {
    // Get the type text from the source file
    const typeText = param.type.getText(sf);
    return typeText;
  }

  return "unknown";
}

/** Try to return the node that actually contains the string literal content for better refs. */
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
      return ret; // still useful (call/identifier) for a reference position
    }
  }
  return fn;
}

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

export function createI18nextAutoKeyTransformerFactory(
  options: I18nextAutoKeyTransformerOptions = {}
): ts.TransformerFactory<ts.SourceFile> {
  const {
    hashLength = 10,
    argMode = "named", // Default to named to better support default i18next usage
    setDefaultValue = false,
    debug = false,
  } = options;

  // Safety: Never enable debug mode in production, even if explicitly set
  const debugEnabled = debug && process.env.NODE_ENV !== "production";

  return (context: ts.TransformationContext) => {
    const f = context.factory;

    const makeI18nextCall = (
      hashId: string,
      argsExpr?: ts.Expression,
      originalString?: string,
      originalNode?: ts.Node
    ): ts.Expression => {
      const i18nextIdent = f.createIdentifier("i18next");
      const tAccess = f.createPropertyAccessExpression(i18nextIdent, "t");
      const callArgs: ts.Expression[] = [f.createStringLiteral(hashId)];

      // If we need to set defaultValue or have other arguments, create an options object
      if ((setDefaultValue && originalString) || argsExpr) {
        let optionsExpr: ts.Expression;

        if (argsExpr && ts.isObjectLiteralExpression(argsExpr)) {
          // If we already have an args object, add defaultValue to it
          const properties = [...argsExpr.properties];
          if (setDefaultValue && originalString) {
            const defaultValueProp = f.createPropertyAssignment(
              f.createIdentifier("defaultValue"),
              f.createStringLiteral(originalString)
            );
            properties.unshift(defaultValueProp); // Add defaultValue first
          }
          optionsExpr = f.createObjectLiteralExpression(properties, true);
        } else {
          // Create new options object
          const properties: ts.ObjectLiteralElementLike[] = [];
          if (setDefaultValue && originalString) {
            properties.push(
              f.createPropertyAssignment(f.createIdentifier("defaultValue"), f.createStringLiteral(originalString))
            );
          }
          optionsExpr = f.createObjectLiteralExpression(properties, true);
        }

        callArgs.push(optionsExpr);
      } else if (argsExpr) {
        // Just pass through the args expression without modification
        callArgs.push(argsExpr);
      }

      const call = f.createCallExpression(tAccess, undefined, callArgs);

      // Preserve source map information from the original node
      if (originalNode) {
        ts.setTextRange(call, originalNode);
        ts.setTextRange(tAccess, originalNode);
      }

      // If debug mode is enabled, wrap the call in a template expression with ~~ markers
      // e.g., `~~${i18next.t("hash")}~~`
      if (debugEnabled) {
        const templateExpression = f.createTemplateExpression(f.createTemplateHead("~~"), [
          f.createTemplateSpan(call, f.createTemplateTail("~~")),
        ]);
        if (originalNode) {
          ts.setTextRange(templateExpression, originalNode);
        }
        return templateExpression;
      }

      return call;
    };

    const buildArgsExpr = (params: readonly ts.ParameterDeclaration[]): ts.Expression | undefined => {
      if (params.length === 0) return undefined;

      if (argMode === "indexed") {
        const indexedProps: ts.PropertyAssignment[] = [];
        params.forEach((p, index) => {
          if (ts.isIdentifier(p.name)) {
            const key = f.createStringLiteral(index.toString());
            const value = f.createIdentifier(p.name.text);
            if (p.name) ts.setTextRange(value, p.name);
            const prop = f.createPropertyAssignment(key, value);
            ts.setTextRange(prop, p.name);
            indexedProps.push(prop);
          }
        });
        if (indexedProps.length === 0) return undefined;

        const obj = f.createObjectLiteralExpression(indexedProps, true);
        if (params.length > 0) ts.setTextRange(obj, { pos: params[0].pos, end: params[params.length - 1].end } as any);
        return obj;
      }

      // "named"
      const namedProps: ts.ShorthandPropertyAssignment[] = [];
      for (const p of params) {
        if (ts.isIdentifier(p.name)) {
          const prop = f.createShorthandPropertyAssignment(p.name);
          ts.setTextRange(prop, p.name);
          namedProps.push(prop);
        }
      }
      if (namedProps.length === 0) return undefined;

      const obj = f.createObjectLiteralExpression(namedProps, true);
      if (params.length > 0) ts.setTextRange(obj, { pos: params[0].pos, end: params[params.length - 1].end } as any);
      return obj;
    };

    let didRewrite = false;

    const visitNode: ts.Visitor = (node) => {
      // Transform property assignments that are functions
      if (
        ts.isPropertyAssignment(node) &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      ) {
        const fn = node.initializer as ts.ArrowFunction | ts.FunctionExpression;
        const sf = node.getSourceFile?.() ?? (node as any).parent?.getSourceFile?.();
        if (!sf) return ts.visitEachChild(node, visitNode, context);

        // Skip if @noTranslate appears on the property OR the function
        if (hasNoTranslateTag(node, sf) || hasNoTranslateTag(fn, sf)) {
          return ts.visitEachChild(node, visitNode, context);
        }

        return processFunction(node, fn, sf, node.name);
      }

      // Transform method declarations (shorthand syntax)
      if (ts.isMethodDeclaration(node) && node.body) {
        const sf = node.getSourceFile?.() ?? (node as any).parent?.getSourceFile?.();
        if (!sf) return ts.visitEachChild(node, visitNode, context);

        // Skip if @noTranslate appears on the method
        if (hasNoTranslateTag(node, sf)) {
          return ts.visitEachChild(node, visitNode, context);
        }

        return processFunction(node, node, sf, node.name);
      }

      return ts.visitEachChild(node, visitNode, context);
    };

    const processFunction = (
      containerNode: ts.PropertyAssignment | ts.MethodDeclaration,
      fn: ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration,
      sf: ts.SourceFile,
      nameNode: ts.PropertyName
    ) => {
      const original = extractReturnStringLiteral(fn);
      if (original !== null) {
        // Intern the string to eliminate memory duplication across stores
        const internedOriginal = stringPool.intern(original);

        // Extract translation context from JSDoc
        const translationContext = extractTranslationContext(containerNode, fn, sf);

        // Create composite key for global store (source + context)
        const compositeKey = translationContext ? `${internedOriginal}::${translationContext}` : internedOriginal;

        // reuse/assign hash
        let id = globalStore.reverse.get(compositeKey);
        if (!id) {
          id = stableHash(internedOriginal, { context: translationContext, hashLength });
          // This collision handling is not deterministic and can result in a different id
          // for the same string, based on the order that the strings are encountered.
          // In practice, this should not matter.
          while (globalStore.seen.has(id) && globalStore.seen.get(id) !== compositeKey) {
            id = stableHash(compositeKey + ":" + id, { hashLength: Math.min(40, hashLength + 2) });
          }
          globalStore.seen.set(id, compositeKey);
          globalStore.reverse.set(compositeKey, id);
        }

        // ── NEW: record reference + comments for POT/PO
        const anchor = anchorForMessageNode(fn) ?? containerNode;
        const start = sf.getLineAndCharacterOfPosition(anchor.getStart(sf)); // 0-based
        const rel = toRelPosix(sf.fileName);
        const line = start.line + 1;
        const column = start.character + 1;
        const comments = [
          // comments on the container (property/method) itself
          ...getLeadingComments(sf, containerNode),
          // and on the actual literal/return expression if different
          ...(anchor !== containerNode ? getLeadingComments(sf, anchor) : []),
        ];

        // Extract parameter metadata for ICU indexed mode context
        const parameterMetadata = extractParameterMetadata(fn, sf);

        i18nStore.add({
          id,
          source: internedOriginal, // Use interned string to avoid duplication
          translationContext,
          ref: { file: rel, line, column },
          comments,
          parameterMetadata,
        });
        // ── END NEW

        const argsExpr = buildArgsExpr(fn.parameters);
        const newBodyExpr = makeI18nextCall(id, argsExpr, internedOriginal, fn.body);

        if (ts.isMethodDeclaration(containerNode)) {
          // Handle method declaration
          const returnStmt = f.createReturnStatement(newBodyExpr);
          ts.setTextRange(returnStmt, fn.body);
          const block = f.createBlock([returnStmt], true);
          ts.setTextRange(block, fn.body);

          const newMethod = f.updateMethodDeclaration(
            containerNode,
            containerNode.modifiers as readonly ts.Modifier[] | undefined,
            containerNode.asteriskToken,
            containerNode.name,
            containerNode.questionToken,
            containerNode.typeParameters,
            containerNode.parameters,
            containerNode.type,
            block
          );

          ts.setTextRange(newMethod, containerNode);
          didRewrite = true;
          return newMethod;
        } else {
          // Handle property assignment
          let newFn: ts.ArrowFunction | ts.FunctionExpression;
          if (ts.isArrowFunction(fn)) {
            newFn = f.updateArrowFunction(
              fn,
              fn.modifiers,
              fn.typeParameters,
              fn.parameters, // keep original params
              fn.type,
              fn.equalsGreaterThanToken ?? f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              newBodyExpr
            );
          } else {
            const returnStmt = f.createReturnStatement(newBodyExpr);
            ts.setTextRange(returnStmt, fn.body);
            const block = f.createBlock([returnStmt], true);
            ts.setTextRange(block, fn.body);
            newFn = f.updateFunctionExpression(
              fn as ts.FunctionExpression,
              fn.modifiers as readonly ts.Modifier[] | undefined,
              (fn as ts.FunctionExpression).asteriskToken,
              (fn as ts.FunctionExpression).name,
              fn.typeParameters,
              fn.parameters,
              fn.type,
              block
            );
          }

          ts.setTextRange(newFn, fn);
          didRewrite = true;
          const updated = f.updatePropertyAssignment(containerNode as ts.PropertyAssignment, nameNode, newFn);
          ts.setTextRange(updated, containerNode);
          return updated;
        }
      }

      return ts.visitEachChild(containerNode, visitNode, context);
    };

    return (sf: ts.SourceFile) => {
      const updated = ts.visitNode(sf, visitNode) as ts.SourceFile;
      if (!updated) return sf;

      if (didRewrite) {
        const hasImport = updated.statements.some(
          (stmt: ts.Statement) =>
            ts.isImportDeclaration(stmt) &&
            ts.isStringLiteral(stmt.moduleSpecifier) &&
            stmt.moduleSpecifier.text === "i18next" &&
            !!stmt.importClause?.name
        );

        if (!hasImport) {
          const importDecl = f.createImportDeclaration(
            undefined,
            f.createImportClause(false, f.createIdentifier("i18next"), undefined),
            f.createStringLiteral("i18next")
          );
          return f.updateSourceFile(updated, [importDecl, ...updated.statements]);
        }
      }
      return updated;
    };
  };
}
