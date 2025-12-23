import type { RollupOptions } from "rollup";
import path from "path";

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
