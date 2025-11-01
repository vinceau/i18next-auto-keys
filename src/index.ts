import { i18nextTranslationLoader } from "./loaders/i18nextTranslationLoader";
import { I18nEmitPlugin } from "./plugins/i18nEmitPlugin";

// Webpack loader compatibility: Export loader as default, plugin as property
module.exports = i18nextTranslationLoader;
module.exports.I18nEmitPlugin = I18nEmitPlugin;
module.exports.i18nextTranslationLoader = i18nextTranslationLoader;

// Also provide TypeScript-friendly named exports for better DX
export { i18nextTranslationLoader, I18nEmitPlugin };