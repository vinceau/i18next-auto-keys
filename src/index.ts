import { i18nextAutoKeyLoader } from "./loaders/i18nextAutoKeyLoader";
import { I18nextAutoKeyEmitPlugin } from "./plugins/i18nextAutoKeyEmitPlugin";

// Webpack loader compatibility: Export loader as default, plugin as property
module.exports = i18nextAutoKeyLoader;
module.exports.I18nextAutoKeyEmitPlugin = I18nextAutoKeyEmitPlugin;
module.exports.i18nextAutoKeyLoader = i18nextAutoKeyLoader;

// Also provide TypeScript-friendly named exports for better DX
export { i18nextAutoKeyLoader, I18nextAutoKeyEmitPlugin };