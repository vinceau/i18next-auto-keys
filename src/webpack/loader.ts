import { validate } from "schema-utils";
import type { LoaderContext } from "webpack";
import type { RawSourceMap } from "source-map";
import ts from "typescript";
import { createI18nextAutoKeyTransformerFactory } from "../transformer/transformer";
import { loadConfig } from "../common/config/loadConfig";

export type I18nextAutoKeyLoaderOptions = {
  sourcemap?: boolean;
  include: RegExp | RegExp[];
  argMode?: "indexed" | "named";
  setDefaultValue?: boolean;
  debug?: boolean;
};

const schema = {
  type: "object",
  properties: {
    sourcemap: { type: "boolean" },
    include: {
      anyOf: [{ instanceof: "RegExp" }, { type: "array", items: { instanceof: "RegExp" } }],
    },
    argMode: { type: "string", enum: ["indexed", "named"] },
    setDefaultValue: { type: "boolean" },
    debug: { type: "boolean" },
  },
  additionalProperties: false,
};

function matchesInclude(include: RegExp | RegExp[], resourcePath: string) {
  if (!include) return true; // no include => process everything
  const arr = Array.isArray(include) ? include : [include];
  return arr.some((re) => re.test(resourcePath));
}

export function i18nextAutoKeyLoader(
  this: LoaderContext<I18nextAutoKeyLoaderOptions>,
  source: string,
  inputMap?: RawSourceMap,
  meta?: any
) {
  // Use webpack 5's getOptions method (this loader targets webpack 5+)
  const loaderOptions: I18nextAutoKeyLoaderOptions = this.getOptions() || {};
  // validate in a version-agnostic way
  validate(schema as any, loaderOptions, { name: "i18next-auto-keys" });

  const { config } = loadConfig();

  const options: I18nextAutoKeyLoaderOptions = {
    ...loaderOptions,
    // Prioritize loader options over config defaults, but use config if no loader option is provided
    argMode: loaderOptions.argMode ?? config.argMode,
  };

  this.cacheable && this.cacheable(true);

  // Skip if not included
  if (!matchesInclude(options.include, this.resourcePath)) {
    // pass through unchanged (preserve prior sourcemap if present)
    this.callback(null, source, inputMap, meta);
    return;
  }

  // ✅ Minimal working version - simpler than full program but still correct
  const sourceFile = ts.createSourceFile(
    this.resourcePath,
    source,
    ts.ScriptTarget.Latest,
    true // ⚠️ setParentNodes REQUIRED for transformations
  );

  const transformer = createI18nextAutoKeyTransformerFactory({
    hashLength: config.hashLength, // This needs to be the same as the config so don't override it with options
    argMode: options.argMode,
    setDefaultValue: options.setDefaultValue,
    debug: options.debug,
  });

  const transformationResult = ts.transform(sourceFile, [transformer]);
  const transformedSourceFile = transformationResult.transformed[0] as ts.SourceFile;

  const printer = ts.createPrinter();
  const result = printer.printFile(transformedSourceFile); // Use printFile for SourceFile

  transformationResult.dispose(); // Clean up

  // ✅ Proper webpack loader protocol
  this.callback(null, result, inputMap, meta);
}
