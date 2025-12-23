import path from "path";
import type { RollupOptions } from "rollup";
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import { i18nextAutoKeyRollupPlugin } from "i18next-auto-keys";

type RollupConfigOptions = {
  configName?: string;
  include?: RegExp;
  setDefaultValue?: boolean;
  jsonOutputPath?: string;
  outputPath?: string;
  outputFormat?: "cjs" | "esm" | "iife";
  argMode?: "indexed" | "named";
  resolveAlias?: Record<string, string>;
  entry?: string;
};

/**
 * Factory function to create different rollup configurations for testing
 */
function createRollupConfig(options: RollupConfigOptions = {}): RollupOptions {
  const {
    configName = "default",
    include = /\.messages\.(ts|tsx)$/,
    setDefaultValue = false,
    jsonOutputPath = "locales/en.json",
    outputPath = "dist",
    outputFormat = "cjs",
    argMode = "named",
    resolveAlias = {},
    entry = "./src/index.ts",
  } = options;

  return {
    input: entry,
    output: {
      dir: path.resolve(__dirname, outputPath),
      format: outputFormat,
      entryFileNames: `bundle-${configName}.js`,
      sourcemap: true,
      exports: "named",
    },
    plugins: [
      resolve({
        extensions: [".ts", ".tsx", ".js", ".jsx"],
      }),
      commonjs(),
      typescript({
        tsconfig: path.resolve(__dirname, "tsconfig.json"),
        compilerOptions: {
          declaration: false,
          declarationMap: false,
          outDir: path.resolve(__dirname, outputPath),
        },
        // Handle path aliases if needed
        ...(Object.keys(resolveAlias).length > 0 && {
          paths: resolveAlias,
        }),
      }),
      i18nextAutoKeyRollupPlugin({
        include: [include],
        argMode,
        setDefaultValue,
        jsonOutputPath,
      }),
    ],
    external: ["i18next", "i18next-icu", "fs", "path"],
  };
}

/**
 * Predefined test configurations
 *
 * NOTE: hashLength is now configured globally via cosmiconfig and defaults to 10.
 * Individual configurations no longer override this value.
 */
const TEST_CONFIGURATIONS = {
  default: createRollupConfig({
    configName: "default",
    setDefaultValue: false,
  }),

  shortHashes: createRollupConfig({
    configName: "short-hashes",
    setDefaultValue: false,
  }),

  longHashes: createRollupConfig({
    configName: "long-hashes",
    setDefaultValue: false,
  }),

  withDefaultValues: createRollupConfig({
    configName: "with-defaults",
    setDefaultValue: true,
  }),

  production: createRollupConfig({
    configName: "production",
  }),

  strictInclude: createRollupConfig({
    configName: "strict-include",
    include: /auth\.messages\.(ts|tsx)$/, // Only auth.messages.ts files
  }),

  noSourcemaps: createRollupConfig({
    configName: "no-sourcemaps",
  }),

  customLoaderOptions: createRollupConfig({
    configName: "custom-loader",
    setDefaultValue: true,
  }),

  indexedArguments: createRollupConfig({
    configName: "indexed-arguments",
    argMode: "indexed",
    resolveAlias: {
      "./auth.messages": path.resolve(__dirname, "src/auth-indexed.messages.ts"),
      "./ui.messages": path.resolve(__dirname, "src/ui-indexed.messages.ts"),
    },
  }),

  translationContext: createRollupConfig({
    configName: "translation-context",
    include: /(context|auth|ui)\.messages\.(ts|tsx)$/, // Include context, auth, and ui messages
  }),
};

export { createRollupConfig, TEST_CONFIGURATIONS };

