// transformers/i18nMessagesTransformer.ts
import ts from "typescript";
import { stableHash } from "../common/hash";
import { i18nStore, toRelPosix } from "../common/i18nStore";
import { stringPool } from "../common/stringPool";

export type I18nextAutoKeyTransformerOptions = {
  hashLength?: number;
  /** How to pass runtime args into i18next.t */
  argMode?: "array" | "named";
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
      if (tags?.some((t: any) => {
        const name = (t.tagName?.escapedText ?? t.tagName?.getText?.(sf)) as string | undefined;
        return name === TAG;
      })) return true;
    } catch { /* ignore */ }
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
      out.push(raw.replace(/^\/\*+|\*+\/$/g, "").split("\n").map(s => s.trim()).join(" ").trim());
    }
  }
  return out.filter(Boolean);
}

/** Try to return the node that actually contains the string literal content for better refs. */
function anchorForMessageNode(fn: ts.ArrowFunction | ts.FunctionExpression): ts.Node | undefined {
  const body = fn.body;
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

function extractReturnStringLiteral(fn: ts.ArrowFunction | ts.FunctionExpression): string | null {
  const body = fn.body;
  if (
    ts.isStringLiteral(body) ||
    ts.isNoSubstitutionTemplateLiteral(body) ||
    ts.isBinaryExpression(body)
  ) {
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
  } = options;

  return (context: ts.TransformationContext) => {
    const f = context.factory;

    const makeI18nextCall = (hashId: string, argsExpr?: ts.Expression, originalNode?: ts.Node): ts.CallExpression => {
      const i18nextIdent = f.createIdentifier("i18next");
      const tAccess = f.createPropertyAccessExpression(i18nextIdent, "t");
      const callArgs: ts.Expression[] = [f.createStringLiteral(hashId)];
      if (argsExpr) callArgs.push(argsExpr);
      const call = f.createCallExpression(tAccess, undefined, callArgs);

      // Preserve source map information from the original node
      if (originalNode) {
        ts.setTextRange(call, originalNode);
        ts.setTextRange(tAccess, originalNode);
      }
      return call;
    };

    const buildArgsExpr = (
      params: readonly ts.ParameterDeclaration[]
    ): ts.Expression | undefined => {
      if (params.length === 0) return undefined;

      if (argMode === "array") {
        const elems = params.map((p) => {
          const id = ts.isIdentifier(p.name) ? f.createIdentifier(p.name.text) : f.createIdentifier("undefined");
          if (p.name) ts.setTextRange(id, p.name);
          return id;
        });
        const arr = f.createArrayLiteralExpression(elems, false);
        if (params.length > 0) ts.setTextRange(arr, { pos: params[0].pos, end: params[params.length - 1].end } as any);
        return arr;
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
      // Only transform object property assignments that are functions
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

        const original = extractReturnStringLiteral(fn);
        if (original !== null) {
          // Intern the string to eliminate memory duplication across stores
          const internedOriginal = stringPool.intern(original);

          // reuse/assign hash
          let id = globalStore.reverse.get(internedOriginal);
          if (!id) {
            id = stableHash(internedOriginal, hashLength);
            // This collision handling is not deterministic and can result in a different id
            // for the same string, based on the order that the strings are encountered.
            // In practice, this should not matter.
            while (globalStore.seen.has(id) && globalStore.seen.get(id) !== internedOriginal) {
              id = stableHash(internedOriginal + ":" + id, Math.min(40, hashLength + 2));
            }
            globalStore.seen.set(id, internedOriginal);
            globalStore.reverse.set(internedOriginal, id);
          }

          // ── NEW: record reference + comments for POT/PO
          const anchor = anchorForMessageNode(fn) ?? node;
          const start = sf.getLineAndCharacterOfPosition(anchor.getStart(sf)); // 0-based
          const rel = toRelPosix(sf.fileName);
          const line = start.line + 1;
          const column = start.character + 1;
          const comments = [
            // comments on the property (key) itself
            ...getLeadingComments(sf, node),
            // and on the actual literal/return expression if different
            ...(anchor !== node ? getLeadingComments(sf, anchor) : []),
          ];

          i18nStore.add({
            id,
            source: internedOriginal, // Use interned string to avoid duplication
            ref: { file: rel, line, column },
            comments,
          });
          // ── END NEW

          const argsExpr = buildArgsExpr(fn.parameters);
          const newBodyExpr = makeI18nextCall(id, argsExpr, fn.body);

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
              fn,
              fn.modifiers,
              fn.asteriskToken,
              fn.name,
              fn.typeParameters,
              fn.parameters,
              fn.type,
              block
            );
          }

          ts.setTextRange(newFn, fn);

          didRewrite = true;
          const updated = f.updatePropertyAssignment(node, node.name, newFn);
          ts.setTextRange(updated, node);

          // (Optional) still writing JSON here; consider moving this to a Webpack plugin to write once per build.
        //   writeDefaultJson(options.jsonOutputPath, globalStore.seen);
          return updated;
        }
      }
      return ts.visitEachChild(node, visitNode, context);
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
