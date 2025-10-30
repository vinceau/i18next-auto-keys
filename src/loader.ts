import { validate } from "schema-utils";
import type { LoaderContext } from "webpack";
import type { RawSourceMap } from "source-map";
import { transform } from "./transform";

export interface LoaderOptions {
    sourcemap?: boolean;
    include?: RegExp | RegExp[];
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

export default function myLoader(this: LoaderContext<LoaderOptions>, source: string, inputMap?: RawSourceMap) {
  // v5 has getOptions; v4 needs loader-utils
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const options: LoaderOptions = this.getOptions
    ? this.getOptions()
    : (require('loader-utils').getOptions(this) || {});

  // validate in a version-agnostic way
  validate(schema as any, options, { name: 'i18next-icu-loader' });

  this.cacheable && this.cacheable(true);
  const asyncCb = this.async();
  try {
    const { code, map } = transform(source, {
      filename: this.resourcePath,
      sourcemap: options.sourcemap !== false,
      inputSourceMap: inputMap as any
    });
    asyncCb(null, code, map as any);
  } catch (err: any) {
    asyncCb(err);
  }
}
