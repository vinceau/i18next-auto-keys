import ts from "typescript";
import { stableHash } from "../common/hash";
import { i18nStore, toRelPosix, ParameterMetadata } from "../common/i18nStore";
import { stringPool } from "../common/stringPool";

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

  const text = sf.getFullText();
  let ranges: readonly ts.CommentRange[] = [];

  const functionRanges = ts.getLeadingCommentRanges?.(text, fn.getFullStart()) || [];
  ranges = [...functionRanges];

  if (!ts.isMethodDeclaration(fn) && fn.parent && ts.isPropertyAssignment(fn.parent)) {
    const parentRanges = ts.getLeadingCommentRanges?.(text, fn.parent.getFullStart()) || [];
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
      const lines = raw.split("\n");
      for (const line of lines) {
        if (line.includes("@param")) {
          const match = line.match(/@param\s+(\w+)\s+(.+)/);
          if (match) {
            const paramName = match[1];
            let paramDescription = match[2];
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
      const paramType = getTypeString(param, sf);
      parameterTypes.push(paramType);
    }
  }

  return parameterNames.length > 0 ? { parameterNames, parameterTypes, parameterJSDoc } : undefined;
}

/** Extract @translationContext from JSDoc comments */
export function extractTranslationContext(
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
    return param.type.getText(sf);
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
      return ret;
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

/**
 * Check if a message node should be transformed.
 * Returns null if it should be skipped, or the extracted string if it should be transformed.
 */
export function shouldTransformNode(
  node: ts.PropertyAssignment | ts.MethodDeclaration,
  fn: ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration,
  sf: ts.SourceFile
): string | null {
  if (hasNoTranslateTag(node, sf) || hasNoTranslateTag(fn, sf)) {
    return null;
  }
  return extractReturnStringLiteral(fn);
}

/**
 * Generate a unique message ID (hash) for the given original string and context.
 * Uses a global store to ensure no duplicates.
 */
export function generateMessageId(
  originalString: string,
  translationContext: string | undefined,
  globalStore: { seen: Map<string, string>; reverse: Map<string, string> },
  hashLength: number
): string {
  const internedOriginal = stringPool.intern(originalString);
  const compositeKey = translationContext ? `${internedOriginal}::${translationContext}` : internedOriginal;

  let idHash = globalStore.reverse.get(compositeKey);
  if (!idHash) {
    idHash = stableHash(internedOriginal, { context: translationContext, hashLength });
    while (globalStore.seen.has(idHash) && globalStore.seen.get(idHash) !== compositeKey) {
      idHash = stableHash(compositeKey + ":" + idHash, { hashLength: Math.min(40, hashLength + 2) });
    }
    globalStore.seen.set(idHash, compositeKey);
    globalStore.reverse.set(compositeKey, idHash);
  }

  return idHash;
}

/**
 * Record the message in the i18nStore with all its metadata.
 */
export function recordMessage(
  idHash: string,
  internedOriginal: string,
  translationContext: string | undefined,
  sf: ts.SourceFile,
  containerNode: ts.PropertyAssignment | ts.MethodDeclaration,
  fn: ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration
): void {
  const anchor = anchorForMessageNode(fn) ?? containerNode;
  const startPos = sf.getLineAndCharacterOfPosition(anchor.getStart(sf));
  const rel = toRelPosix(sf.fileName);
  const line = startPos.line + 1;
  const column = startPos.character + 1;

  const comments = [
    ...getLeadingComments(sf, containerNode),
    ...(anchor !== containerNode ? getLeadingComments(sf, anchor) : []),
  ];

  const parameterMetadata = extractParameterMetadata(fn, sf);

  i18nStore.add({
    id: idHash,
    source: internedOriginal,
    translationContext,
    ref: { file: rel, line, column },
    comments,
    parameterMetadata,
  });
}
