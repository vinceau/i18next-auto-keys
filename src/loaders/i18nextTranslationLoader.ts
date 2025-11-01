import { validate } from "schema-utils";
import type { LoaderContext } from "webpack";
import type { RawSourceMap } from "source-map";
import ts from "typescript";
import { createI18nextTranslationTransformerFactory } from "../transformers/i18nextTranslationTransformer";

export type I18nextTranslationLoaderOptions = {
    sourcemap?: boolean;
    include: RegExp | RegExp[];
    hashLength?: number;
    argMode?: "array" | "named";
}

const schema = {
    type: 'object',
    properties: {
      sourcemap: { type: 'boolean' },
      include: {
        anyOf: [
          { instanceof: 'RegExp' },
          { type: 'array', items: { instanceof: 'RegExp' } }
        ]
      },
      hashLength: { type: 'number', minimum: 10 },
      argMode: { type: 'string', enum: ['array', 'named'] }
    },
    additionalProperties: false
  };

function matchesInclude(include: RegExp | RegExp[], resourcePath: string) {
    if (!include) return true; // no include => process everything
    const arr = Array.isArray(include) ? include : [include];
    return arr.some((re) => re.test(resourcePath));
}

export function i18nextTranslationLoader(this: LoaderContext<I18nextTranslationLoaderOptions>, source: string, inputMap?: RawSourceMap, meta?: any) {
  // v5 has getOptions; v4 needs loader-utils
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const options: I18nextTranslationLoaderOptions = this.getOptions
    ? this.getOptions()
    : (require('loader-utils').getOptions(this) || {});

  // validate in a version-agnostic way
  validate(schema as any, options, { name: 'i18next-icu-loader' });

  this.cacheable && this.cacheable(true);

  // Skip if not included
  if (!matchesInclude(options.include, this.resourcePath)) {
    // pass through unchanged (preserve prior sourcemap if present)
    this.callback(null, source, inputMap, meta);
    return;
  }

  const asyncCb = this.async();
  try {
    const transformer = createI18nextTranslationTransformerFactory({
      hashLength: options.hashLength,
      argMode: options.argMode,
    });
    const sourceFile = ts.createSourceFile(this.resourcePath, source, ts.ScriptTarget.Latest);
    const transformationResult = ts.transform(sourceFile, [transformer]);
    const transformedSourceFile = transformationResult.transformed[0];
    const printer = ts.createPrinter();
    const result = printer.printNode(ts.EmitHint.Unspecified, transformedSourceFile, sourceFile);
    asyncCb(null, result, inputMap, meta);
  } catch (err: unknown) {
    asyncCb(err as Error);
  }
}
