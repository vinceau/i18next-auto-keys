// plugins/I18nextAutoKeyEmitPlugin.ts
import type { Compiler } from "webpack";
import { i18nStore } from "../common/i18nStore";
import { emitIfChanged } from "./emitIfChanged";
import type { Configuration } from "../common/config/loadConfig";
import { loadConfig } from "../common/config/loadConfig";

export type I18nextAutoKeyEmitPluginOptions = {
  /** Path inside Webpack output where the runtime JSON should be emitted (e.g. "i18n/en.json"). */
  jsonOutputPath: string;
  /** Optional top level key to wrap translations under. If undefined, translations are placed at root level. */
  topLevelKey?: string;
};

/**
 * Emits i18n JSON assets once per compilation using entries collected in i18nStore.
 */
export class I18nextAutoKeyEmitPlugin {
  private readonly jsonOutputPath: string;
  private readonly topLevelKey?: string;
  private readonly configuration: Configuration;

  constructor(opts: I18nextAutoKeyEmitPluginOptions) {
    this.jsonOutputPath = opts.jsonOutputPath;
    this.configuration = loadConfig();
    this.topLevelKey = this.configuration.config.topLevelKey ?? opts.topLevelKey;
  }

  apply(compiler: Compiler): void {
    const { Compilation, sources } = compiler.webpack;
    const pluginName = "I18nextAutoKeyEmitPlugin";

    // add the config file as a build dependency so changes trigger rebuilds:
    const cfgFile = this.configuration.file;
    if (cfgFile) {
      compiler.hooks.thisCompilation.tap("I18nextAutokeyConfig", (compilation) =>
        compilation.fileDependencies.add(cfgFile)
      );
    }

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
          const entries = Array.from(i18nStore.all().values()).sort((a, b) => a.id.localeCompare(b.id));

          // --- JSON (id -> source) ---
          const dict: Record<string, string> = {};
          for (const e of entries) dict[e.id] = e.source;

          // Optionally wrap under topLevelKey
          const finalOutput = this.topLevelKey ? { [this.topLevelKey]: dict } : dict;

          const indentSpaces = this.configuration.config.jsonIndentSpaces;
          const jsonBuf = Buffer.from(JSON.stringify(finalOutput, null, indentSpaces), "utf8");
          emitIfChanged(compilation, sources, this.normalize(this.jsonOutputPath), jsonBuf);
        }
      );
    });
  }

  private normalize(p: string | undefined): string {
    return (p ?? "").replace(/\\/g, "/");
  }
}
