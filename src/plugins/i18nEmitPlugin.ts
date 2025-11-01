// plugins/I18nEmitPlugin.ts
import type * as webpack from "webpack";
import { i18nStore } from "../common/i18nStore";
import type { GetTextTranslationRecord } from "gettext-parser";

// Optional dependency: only needed if you set `potOutputPath`
let gettextParser: typeof import("gettext-parser") | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  gettextParser = require("gettext-parser");
} catch {
  // Not installed; POT emission will be skipped if potOutputPath is set
}

export interface I18nEmitPluginOptions {
  /** Path inside Webpack output where the runtime JSON should be emitted (e.g. "i18n/en.json"). */
  jsonOutputPath: string;
  /** Optional path inside Webpack output where the POT template should be emitted (e.g. "i18n/messages.pot"). */
  potOutputPath?: string;
  /** Optional "Project-Id-Version" header value for POT. */
  projectIdVersion?: string; // e.g., "slippi-stats 1.0"
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

  constructor(opts: I18nEmitPluginOptions) {
    this.jsonOutputPath = opts.jsonOutputPath;
    this.potOutputPath = opts.potOutputPath;
    this.projectIdVersion = opts.projectIdVersion ?? "app 1.0";
  }

  apply(compiler: webpack.Compiler): void {
    const { Compilation, sources } = compiler.webpack;
    const pluginName = "I18nEmitPlugin";

    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      // Start each compilation fresh; transformer will repopulate the store.
      i18nStore.clear();

      compilation.hooks.processAssets.tap(
        {
          name: pluginName,
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          // Build a stable snapshot of entries
          const entries = Array.from(i18nStore.all().values()).sort((a, b) =>
            a.id.localeCompare(b.id)
          );

          // --- JSON (id -> source) ---
          const dict: Record<string, string> = {};
          for (const e of entries) dict[e.id] = e.source;

          const jsonBuf = Buffer.from(JSON.stringify(dict, null, 2), "utf8");
          compilation.emitAsset(this.normalize(this.jsonOutputPath), new sources.RawSource(jsonBuf));

          // --- POT (optional) ---
          if (this.potOutputPath && gettextParser) {
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

            const potBuf = gettextParser.po.compile(catalog);
            compilation.emitAsset(this.normalize(this.potOutputPath), new sources.RawSource(potBuf));
          }
        }
      );
    });
  }

  private normalize(p: string | undefined): string {
    return (p ?? "").replace(/\\/g, "/");
  }
}
