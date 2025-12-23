import path from "path";
import type { InlineConfig } from "vite";
import { i18nextAutoKeyRollupPlugin } from "i18next-auto-keys";

type ViteConfigOptions = {
  configName?: string;
  include?: RegExp;
  setDefaultValue?: boolean;
  jsonOutputPath?: string;
  outputPath?: string;
  argMode?: "indexed" | "named";
  resolveAlias?: Record<string, string>;
  entry?: string;
};

/**
 * Factory function to create different Vite configurations for testing
 * Returns an object with the Vite config and the jsonOutputPath for test consumption
 * 
 * Note: Vite uses Rollup under the hood for builds, so the i18nextAutoKeyRollupPlugin
 * works seamlessly with Vite's build process.
 */
function createViteConfig(options: ViteConfigOptions = {}): { config: InlineConfig; jsonOutputPath: string } {
  const {
    configName = "default",
    include = /\.messages\.(ts|tsx)$/,
    setDefaultValue = false,
    outputPath = path.resolve(__dirname, "../../dist/vite"),
    argMode = "named",
    resolveAlias = {},
    entry = path.resolve(__dirname, "../../fixtures/index.ts"),
  } = options;

  // Always use standard translation file name unless explicitly overridden
  const jsonOutputPath = options.jsonOutputPath || "locales/en.json";

  return {
    config: {
      // Vite doesn't support absolute entry paths in library mode input, use relative resolution
      build: {
        lib: {
          entry,
          formats: ["cjs"],
          fileName: () => `bundle-${configName}.js`,
        },
        outDir: outputPath,
        sourcemap: true,
        rollupOptions: {
          external: ["i18next", "i18next-icu", "fs", "path"],
          output: {
            exports: "named",
          },
        },
        // Clear the output directory before each build
        emptyOutDir: false,
      },
      plugins: [
        i18nextAutoKeyRollupPlugin({
          include: [include],
          argMode,
          setDefaultValue,
          jsonOutputPath,
        }),
      ],
      resolve: {
        alias: resolveAlias,
      },
    },
    jsonOutputPath,
  };
}

/**
 * Predefined test configurations for Vite
 *
 * NOTE: hashLength is now configured globally via cosmiconfig and defaults to 10.
 * Individual configurations no longer override this value.
 */
const TEST_CONFIGURATIONS = {
  default: createViteConfig({
    configName: "default",
    setDefaultValue: false,
  }),

  shortHashes: createViteConfig({
    configName: "short-hashes",
    setDefaultValue: false,
  }),

  longHashes: createViteConfig({
    configName: "long-hashes",
    setDefaultValue: false,
  }),

  withDefaultValues: createViteConfig({
    configName: "with-defaults",
    setDefaultValue: true,
  }),

  production: createViteConfig({
    configName: "production",
  }),

  strictInclude: createViteConfig({
    configName: "strict-include",
    include: /auth\.messages\.(ts|tsx)$/, // Only auth.messages.ts files
  }),

  noSourcemaps: createViteConfig({
    configName: "no-sourcemaps",
  }),

  customLoaderOptions: createViteConfig({
    configName: "custom-loader",
    setDefaultValue: true,
  }),

  indexedArguments: createViteConfig({
    configName: "indexed-arguments",
    argMode: "indexed",
    resolveAlias: {
      "./messages/auth.messages": path.resolve(__dirname, "../../fixtures/messages/auth-indexed.messages.ts"),
      "./messages/ui.messages": path.resolve(__dirname, "../../fixtures/messages/ui-indexed.messages.ts"),
    },
  }),

  translationContext: createViteConfig({
    configName: "translation-context",
    include: /(context|auth|ui)\.messages\.(ts|tsx)$/, // Include context, auth, and ui messages
  }),
};

export { createViteConfig, TEST_CONFIGURATIONS };

