// plugins/I18nEmitPlugin.ts
import type { Compiler } from "webpack";
import { i18nStore } from "../common/i18nStore";
import type { GetTextTranslationRecord } from "gettext-parser";
import { emitIfChanged } from "./emitIfChanged";

// Optional dependency: only needed if you set `potOutputPath`
// Support both CommonJS (v7.x) and ESM (v8.x+) versions
let gettextParser: typeof import("gettext-parser") | undefined;
let gettextParserLoadPromise: Promise<typeof import("gettext-parser")> | undefined;

async function loadGettextParser(): Promise<typeof import("gettext-parser") | undefined> {
  // Return cached result if already loaded
  if (gettextParser) return gettextParser;

  // Return cached promise if already loading
  if (gettextParserLoadPromise) return gettextParserLoadPromise;

  // Try CommonJS first (gettext-parser v7.x and below)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    gettextParser = require("gettext-parser");
    return gettextParser;
  } catch (error: any) {
    // If it's an ESM error, try dynamic import (gettext-parser v8.x+)
    if (error?.code === 'ERR_REQUIRE_ESM') {
      try {
        gettextParserLoadPromise = import("gettext-parser");
        gettextParser = await gettextParserLoadPromise;
        return gettextParser;
      } catch (importError: any) {
        console.warn("I18nEmitPlugin: Could not load gettext-parser:", importError.message);
        return undefined;
      }
    }
    // Package not installed
    return undefined;
  }
}

export type I18nEmitPluginOptions = {
  /** Path inside Webpack output where the runtime JSON should be emitted (e.g. "i18n/en.json"). */
  jsonOutputPath: string;
  /** Optional path inside Webpack output where the POT template should be emitted (e.g. "i18n/messages.pot"). */
  potOutputPath?: string;
  /** Optional "Project-Id-Version" header value for POT. */
  projectIdVersion?: string; // e.g., "slippi-stats 1.0"
  /** Optional top level key to wrap translations under. If undefined, translations are placed at root level. */
  topLevelKey?: string;
}

/**
 * Emits i18n assets once per compilation using entries collected in i18nStore:
 * - JSON: { [id]: sourceString }
 * - POT: msgctxt=id, msgid=source, with "#: file:line:column" and "#. comment" lines
 */
export class I18nEmitPlugin {
  private readonly jsonOutputPath: string;
  private readonly potOutputPath?: string;
  private readonly projectIdVersion: string;
  private readonly topLevelKey?: string;

  constructor(opts: I18nEmitPluginOptions) {
    this.jsonOutputPath = opts.jsonOutputPath;
    this.potOutputPath = opts.potOutputPath;
    this.projectIdVersion = opts.projectIdVersion ?? "app 1.0";
    this.topLevelKey = opts.topLevelKey;
  }

  apply(compiler: Compiler): void {
    const { Compilation, sources } = compiler.webpack;
    const pluginName = "I18nEmitPlugin";

    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      // Start each compilation fresh; transformer will repopulate the store.
      i18nStore.clear();

      compilation.hooks.processAssets.tapPromise(
        {
          name: pluginName,
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        async (assets) => {
          // Build a stable snapshot of entries
          const entries = Array.from(i18nStore.all().values()).sort((a, b) =>
            a.id.localeCompare(b.id)
          );

          // --- JSON (id -> source) ---
          const dict: Record<string, string> = {};
          for (const e of entries) dict[e.id] = e.source;

          // Optionally wrap under topLevelKey
          const finalOutput = this.topLevelKey
            ? { [this.topLevelKey]: dict }
            : dict;

          const jsonBuf = Buffer.from(JSON.stringify(finalOutput, null, 2), "utf8");
          emitIfChanged(compilation, sources, this.normalize(this.jsonOutputPath), jsonBuf);

          // --- POT (optional) ---
          if (this.potOutputPath) {
            const parser = await loadGettextParser();
            if (parser) {
            const catalog = {
              charset: "utf-8",
              headers: {
                "project-id-version": this.projectIdVersion,
                "mime-version": "1.0",
                "content-type": "text/plain; charset=UTF-8",
                "content-transfer-encoding": "8bit",
                "x-generator": pluginName,
                language: "", // empty in POT templates
              },
              translations: { "": {} } as GetTextTranslationRecord,
            };

            for (const e of entries) {
              catalog.translations[""][e.source] = {
                msgid: e.source,
                msgctxt: e.id,
                msgstr: [""],
                comments: {
                  reference: Array.from(e.refs).sort().join("\n") || undefined,       // "#: file:line:column"
                  extracted: Array.from(e.extractedComments).sort().join("\n") || undefined, // "#. comment"
                },
              };
            }

            const potBuf = parser.po.compile(catalog);
            emitIfChanged(compilation, sources, this.normalize(this.potOutputPath), potBuf);
            }
          }
        }
      );
    });
  }

  private normalize(p: string | undefined): string {
    return (p ?? "").replace(/\\/g, "/");
  }
}
