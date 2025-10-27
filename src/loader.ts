import type { LoaderContext } from "webpack";
import type { RawSourceMap } from "source-map";
import { transform } from "./transform";

export interface LoaderOptions { sourcemap?: boolean }

export default function myLoader(this: LoaderContext<LoaderOptions>, source: string, inputMap?: RawSourceMap) {
  this.cacheable && this.cacheable(true);
  const asyncCb = this.async();
  try {
    const { code, map } = transform(source, {
      filename: this.resourcePath,
      sourcemap: this.getOptions().sourcemap !== false,
      inputSourceMap: inputMap as any
    });
    asyncCb(null, code, map as any);
  } catch (err: any) {
    asyncCb(err);
  }
}
