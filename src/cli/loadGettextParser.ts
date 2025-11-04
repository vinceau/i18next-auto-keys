// Support CJS (v7-) and ESM default export (v8+)
import type { PoParser } from "gettext-parser";
export type PoApi = { po?: PoParser };

let gettextParserModule: PoApi | undefined;
let loadPromise: Promise<PoApi | undefined> | undefined;

// Keep a single dynamic import function that TS won’t downlevel.
const dynamicImport: (s: string) => Promise<any> =
  // eslint-disable-next-line no-new-func
  new Function("s", "return import(s)") as any;

export async function loadGettextParser(): Promise<PoApi | undefined> {
  if (gettextParserModule) return gettextParserModule;
  if (loadPromise) return loadPromise;

  // Try CJS first (works in both Node & webpack)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("gettext-parser") as any;
    gettextParserModule = (mod?.po ? mod : mod?.default) as PoApi | undefined;
    return gettextParserModule;
  } catch (error: any) {
    // Ignore and try ESM
  }

  // Fallback: ESM dynamic import (v8+)
  loadPromise = dynamicImport("gettext-parser")
    .then((m: any) => (m?.po ? m : m?.default) as PoApi | undefined)
    .catch(() => undefined);

  gettextParserModule = await loadPromise;
  return gettextParserModule;
}
