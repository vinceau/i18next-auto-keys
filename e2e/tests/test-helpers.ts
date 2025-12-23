import fs from "fs";
import path from "path";
import type { InlineConfig } from "vite";
import type { RollupOptions } from "rollup";

/**
 * Shared test helper utilities for e2e tests
 */

/**
 * Helper function to build Vite with a specific configuration
 * Used by both Vite e2e.test.ts and icu.e2e.test.ts
 */
export async function buildWithVite(configWithPath: { config: InlineConfig; jsonOutputPath: string }): Promise<{
  bundlePath: string;
  translationsPath: string;
}> {
  const { config, jsonOutputPath } = configWithPath;

  // Dynamically import Vite to handle ESM
  const { build } = await import("vite");
  
  // Run Vite build with configFile: false to use inline config only
  // Use logLevel: 'silent' to suppress build output in tests
  await build({
    ...config,
    configFile: false,
    logLevel: 'silent',
  });

  // Determine output paths from build config
  const outputDir = config.build?.outDir || path.resolve(__dirname, "../dist/vite");
  const lib = config.build?.lib;
  
  let fileName = "bundle-default.js";
  if (lib && typeof lib !== "boolean") {
    if (typeof lib.fileName === "function") {
      fileName = lib.fileName("cjs", "");
    } else if (typeof lib.fileName === "string") {
      fileName = lib.fileName;
    }
  }
  
  const bundlePath = path.join(outputDir, fileName);
  const translationsPath = path.join(outputDir, jsonOutputPath);

  return { bundlePath, translationsPath };
}

/**
 * Helper function to build Rollup with a specific configuration
 * Used by both Rollup e2e.test.ts and icu.e2e.test.ts
 */
export async function buildWithRollup(configWithPath: { config: RollupOptions; jsonOutputPath: string }): Promise<{
  bundlePath: string;
  translationsPath: string;
}> {
  const { config, jsonOutputPath } = configWithPath;
  const { rollup } = await import("rollup");
  
  const bundle = await rollup(config);

  // Generate the output
  if (Array.isArray(config.output)) {
    await bundle.write(config.output[0]);
  } else if (config.output) {
    await bundle.write(config.output);
  } else {
    throw new Error("No output configuration found");
  }

  await bundle.close();

  const outputConfig = Array.isArray(config.output) ? config.output[0] : config.output!;
  const configName = outputConfig.entryFileNames?.toString().replace("bundle-", "").replace(".js", "") || "default";
  const bundlePath = path.join(outputConfig.dir!, `bundle-${configName}.js`);
  const translationsPath = path.join(outputConfig.dir!, jsonOutputPath);

  return { bundlePath, translationsPath };
}

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

