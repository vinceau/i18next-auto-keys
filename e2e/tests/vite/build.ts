import type { InlineConfig } from "vite";
import path from "path";

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
