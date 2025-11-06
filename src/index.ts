import { i18nextAutoKeyLoader } from "./loaders/i18nextAutoKeyLoader";
import { I18nextAutoKeyEmitPlugin } from "./plugins/i18nextAutoKeyEmitPlugin";
import { createI18nextAutoKeyTransformerFactory } from "./transformers/i18nextAutoKeyTransformer";
import { i18nStore } from "./common/i18nStore";
import { loadConfig } from "./common/config/loadConfig";
import { stableHash, stableHashWithContext } from "./common/hash";

// Webpack loader compatibility: Export loader as default, plugin as property
module.exports = i18nextAutoKeyLoader;
module.exports.I18nextAutoKeyEmitPlugin = I18nextAutoKeyEmitPlugin;
module.exports.i18nextAutoKeyLoader = i18nextAutoKeyLoader;

// Shared functionality for CLI and advanced users
module.exports.createI18nextAutoKeyTransformerFactory = createI18nextAutoKeyTransformerFactory;
module.exports.i18nStore = i18nStore;
module.exports.loadConfig = loadConfig;
module.exports.stableHash = stableHash;
module.exports.stableHashWithContext = stableHashWithContext;

// Also provide TypeScript-friendly named exports for better DX
export {
  i18nextAutoKeyLoader,
  I18nextAutoKeyEmitPlugin,
  createI18nextAutoKeyTransformerFactory,
  i18nStore,
  loadConfig,
  stableHash,
  stableHashWithContext,
};
