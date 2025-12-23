import { validate } from "schema-utils";
import type { LoaderContext } from "webpack";
import type { RawSourceMap } from "source-map";
import { transformMessages } from "../transformer/transformer";
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

  // Use the unified core transformer (same as Rollup)
  const result = transformMessages(source, this.resourcePath, {
    argMode: options.argMode ?? "named",
    setDefaultValue: options.setDefaultValue ?? false,
    debug: options.debug ?? false,
    hashLength: config.hashLength,
  });

  // Pass through if no transformation occurred
  if (!result.didTransform) {
    this.callback(null, source, inputMap, meta);
    return;
  }

  // Return transformed code with source map
  // Webpack expects source maps in a specific format
  this.callback(null, result.code, result.map, meta);
}
