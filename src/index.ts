import { i18nextAutoKeyLoader } from "./webpack/loader";
import { I18nextAutoKeyEmitPlugin } from "./webpack/plugin";
import { i18nextAutoKeyRollupPlugin } from "./rollup/plugin";
import { createI18nextAutoKeyTransformerFactory } from "./transformer/transformer";
import { transformMessages } from "./transformer/core";
import { i18nStore } from "./common/i18nStore";
import { loadConfig } from "./common/config/loadConfig";
import { stableHash } from "./common/hash";

// Webpack loader compatibility: Export loader as default, plugin as property
module.exports = i18nextAutoKeyLoader;
module.exports.I18nextAutoKeyEmitPlugin = I18nextAutoKeyEmitPlugin;
module.exports.i18nextAutoKeyLoader = i18nextAutoKeyLoader;
module.exports.i18nextAutoKeyRollupPlugin = i18nextAutoKeyRollupPlugin;

// Shared functionality for CLI and advanced users
module.exports.createI18nextAutoKeyTransformerFactory = createI18nextAutoKeyTransformerFactory;
module.exports.transformMessages = transformMessages;
module.exports.i18nStore = i18nStore;
module.exports.loadConfig = loadConfig;
module.exports.stableHash = stableHash;
// stableHashWithContext is now merged into stableHash

// Also provide TypeScript-friendly named exports for better DX
export {
  i18nextAutoKeyLoader,
  I18nextAutoKeyEmitPlugin,
  i18nextAutoKeyRollupPlugin,
  createI18nextAutoKeyTransformerFactory,
  transformMessages,
  i18nStore,
  loadConfig,
  stableHash,
};
