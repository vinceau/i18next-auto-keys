import ts from "typescript";
import fs from "fs";
import path from "path";
import { stableHash } from "./hash";

export interface I18nTransformerOptions {
  jsonOutputPath: string;
  poOutputPath?: string;
  hashLength?: number;
  onlyMessagesFiles?: boolean;
  /** How to pass runtime args into i18next.t */
  argMode?: "array" | "named";
}

const globalStore: {
  seen: Map<string, string>;
  reverse: Map<string, string>;
} = {
  seen: new Map(),
  reverse: new Map(),
};

function writeDefaultJson(filePath: string, pairs: Map<string, string>) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const json = JSON.stringify(Object.fromEntries(pairs), null, 2);
  fs.writeFileSync(filePath, json, "utf8");
}

/** Best-effort check for a `@noTranslate` jsdoc/tsdoc tag on this node. */
function hasNoTranslateTag(node: ts.Node, sf: ts.SourceFile): boolean {
  const TAG = "noTranslate";

  // 1) Modern helper if present
  const anyTs: any = ts as any;
  if (typeof anyTs.getJSDocTags === "function") {
    try {
      const tags: readonly ts.JSDocTag[] = anyTs.getJSDocTags(node);
      if (tags?.some((t: any) => {
        const name = (t.tagName?.escapedText ?? t.tagName?.getText?.(sf)) as string | undefined;
        return name === TAG;
      })) return true;
    } catch {
      // fall through
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
      // textual comment fallback
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

export default function i18nMessagesTransformer(
  program: ts.Program,
  options: I18nTransformerOptions
): ts.TransformerFactory<ts.SourceFile> {
  const {
    jsonOutputPath,
    hashLength = 10,
    onlyMessagesFiles = true,
    argMode = "array",
  } = options || ({} as I18nTransformerOptions);
  return (context: ts.TransformationContext) => {
    const f = context.factory;

    const makeI18nextCall = (hashId: string, argsExpr?: ts.Expression): ts.CallExpression => {
      const i18nextIdent = f.createIdentifier("i18next");
      const tAccess = f.createPropertyAccessExpression(i18nextIdent, "t");
      const callArgs: ts.Expression[] = [f.createStringLiteral(hashId)];
      if (argsExpr) callArgs.push(argsExpr);
      const call = f.createCallExpression(tAccess, undefined, callArgs);
      // Help sourcemaps a bit by inheriting the span of the original body (set later).
      return call;
    };

    const buildArgsExpr = (
      params: readonly ts.ParameterDeclaration[]
    ): ts.Expression | undefined => {
      if (params.length === 0) return undefined;

      if (argMode === "array") {
        const elems = params.map((p) =>
          ts.isIdentifier(p.name) ? f.createIdentifier(p.name.text) : f.createIdentifier("undefined")
        );
        return f.createArrayLiteralExpression(elems, false);
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
    };

    let didRewrite = false;

    const visitNode: ts.Visitor = (node) => {
      // Only transform object property assignments that are functions
      if (
        ts.isPropertyAssignment(node) &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      ) {
        const fn = node.initializer as ts.ArrowFunction | ts.FunctionExpression;
        const sf = node.getSourceFile?.() ?? (node as any).parent?.getSourceFile?.() ?? (program as any).getSourceFile;

        // Skip if @noTranslate appears on the property OR the function
        if (sf && (hasNoTranslateTag(node, sf) || hasNoTranslateTag(fn, sf))) {
          return ts.visitEachChild(node, visitNode, context); // leave untouched, but still traverse children
        }

        const original = extractReturnStringLiteral(fn);
        if (original !== null) {
          // reuse/assign hash
          let id = globalStore.reverse.get(original);
          if (!id) {
            id = stableHash(original, hashLength);
            while (globalStore.seen.has(id) && globalStore.seen.get(id) !== original) {
              id = stableHash(original + ":" + id, Math.min(40, hashLength + 2));
            }
            globalStore.seen.set(id, original);
            globalStore.reverse.set(original, id);
          }

          const argsExpr = buildArgsExpr(fn.parameters);
          const newBodyExpr = makeI18nextCall(id, argsExpr);
          // optional: improve mapping by inheriting the old body span
          ts.setTextRange(newBodyExpr, fn.body);

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
            newFn = f.updateFunctionExpression(
              fn,
              fn.modifiers,
              fn.asteriskToken,
              fn.name,
              fn.typeParameters,
              fn.parameters,
              fn.type,
              f.createBlock([f.createReturnStatement(newBodyExpr)], true)
            );
          }

          didRewrite = true;
          const updated = f.updatePropertyAssignment(node, node.name, newFn);
          writeDefaultJson(jsonOutputPath, globalStore.seen);
          return updated;
        }
      }
      return ts.visitEachChild(node, visitNode, context);
    };

    return (sf: ts.SourceFile) => {
    //   if (onlyMessagesFiles && !/\.messages\.ts$/.test(sf.fileName)) {
    //     return sf;
    //   }

      const updated = ts.visitNode(sf, visitNode) as ts.SourceFile;
      if (!updated) {
        return sf;
      }

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
