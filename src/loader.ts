import { validate } from "schema-utils";
import type { LoaderContext } from "webpack";
import type { RawSourceMap } from "source-map";
import { transform } from "./transform";

export interface LoaderOptions {
    sourcemap?: boolean;
    include: RegExp | RegExp[];
    jsonOutputPath?: string;
    poOutputPath?: string;
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
      jsonOutputPath: { type: 'string' },
      poOutputPath: { type: 'string' },
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

export default function myLoader(this: LoaderContext<LoaderOptions>, source: string, inputMap?: RawSourceMap, meta?: any) {
  // v5 has getOptions; v4 needs loader-utils
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const options: LoaderOptions = this.getOptions
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
    const { code, map } = transform(source, {
      filename: this.resourcePath,
      sourcemap: options.sourcemap !== false,
      inputSourceMap: inputMap,
    });
    asyncCb(null, code, map);
  } catch (err: unknown) {
    asyncCb(err as Error);
  }
}
