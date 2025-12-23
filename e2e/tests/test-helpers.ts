import fs from "fs";
import path from "path";

/**
 * Shared test helper utilities for e2e tests
 */

/**
 * Helper to clean build artifacts for a specific configuration
 * Used by both Rollup and Vite tests
 */
export function cleanConfigArtifacts(configName: string, distPath: string): void {
  const bundlePath = path.join(distPath, `bundle-${configName}.js`);
  const bundleMapPath = path.join(distPath, `bundle-${configName}.js.map`);
  const translationsPath = path.join(distPath, "locales/en.json");

  [bundlePath, bundleMapPath, translationsPath].forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  });
}

/**
 * Helper to clean ICU test artifacts for a specific configuration
 * Used by both Rollup and Vite ICU tests
 */
export function cleanIcuConfigArtifacts(configName: string, distPath: string): void {
  const bundlePath = path.join(distPath, `bundle-${configName}.js`);
  const bundleMapPath = path.join(distPath, `bundle-${configName}.js.map`);
  const translationsPath = path.join(distPath, `locales/${configName}-en.json`);

  [bundlePath, bundleMapPath, translationsPath].forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
}

/**
 * Helper to clear require cache for fresh module loading
 * Prevents global state from persisting across test configurations
 */
export function clearModuleCache(): void {
  Object.keys(require.cache).forEach((key) => {
    if (key.includes("dist/index.js") || key.includes("i18next-auto-keys")) {
      delete require.cache[key];
    }
  });
}

/**
 * Helper to clear require cache for a specific bundle and i18next
 * Used when loading test bundles to ensure fresh state
 */
export function clearBundleCache(bundlePath: string): void {
  Object.keys(require.cache).forEach((key) => {
    if (key.includes(path.dirname(bundlePath)) || key.includes("i18next")) {
      delete require.cache[key];
    }
  });
}
