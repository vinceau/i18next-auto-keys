// transformers/i18nMessagesTransformer.ts
import ts from "typescript";
import {
  shouldTransformNode,
  generateMessageId,
  recordMessage,
  extractTranslationContext,
  hasNoTranslateTag,
  extractReturnStringLiteral,
  extractParameterMetadata,
  anchorForMessageNode,
  getLeadingComments,
} from "./transformHelpers";
import { stringPool } from "../common/stringPool";
import { i18nStore, toRelPosix } from "../common/i18nStore";

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
 * Shared across all transformations in this build.
 */
const globalStore: {
  seen: Map<string, string>;
  reverse: Map<string, string>;
} = {
  seen: new Map(),
  reverse: new Map(),
};

export function createI18nextAutoKeyTransformerFactory(
  options: I18nextAutoKeyTransformerOptions = {}
): ts.TransformerFactory<ts.SourceFile> {
  const {
    hashLength = 10,
    argMode = "named", // Default to named to better support default i18next usage
    setDefaultValue = false,
    debug = false,
  } = options;

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
      if (debug) {
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
      const original = shouldTransformNode(containerNode, fn, sf);
      if (original !== null) {
        // Extract translation context from JSDoc
        const translationContext = extractTranslationContext(containerNode, fn, sf);

        // Generate unique message ID (hash) using shared core logic
        const id = generateMessageId(original, translationContext, globalStore, hashLength);
        
        // Intern the string after generating the hash to maintain consistency
        const internedOriginal = stringPool.intern(original);

        // Record the message in the i18n store using shared core logic
        recordMessage(id, internedOriginal, translationContext, sf, containerNode, fn);

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
