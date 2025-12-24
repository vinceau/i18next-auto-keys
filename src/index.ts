import { i18nextAutoKeyLoader } from "./webpack/loader";
import { I18nextAutoKeyEmitPlugin } from "./webpack/plugin";
import { i18nextAutoKeyRollupPlugin } from "./rollup/plugin";
import { transformMessages } from "./common/transformer/transformer";
import { i18nStore } from "./common/i18nStore";
import { loadConfig } from "./common/config/loadConfig";
import { stableHash } from "./common/hash";

// ESM named exports
export {
  i18nextAutoKeyLoader,
  I18nextAutoKeyEmitPlugin,
  i18nextAutoKeyRollupPlugin,
  transformMessages,
  i18nStore,
  loadConfig,
  stableHash,
};

// Default export for Webpack loader compatibility
export default i18nextAutoKeyLoader;
