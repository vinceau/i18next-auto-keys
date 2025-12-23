import path from "path";
import { Configuration } from "webpack";
const { I18nextAutoKeyEmitPlugin } = require("i18next-auto-keys");

type WebpackConfigOptions = {
  configName?: string;
  mode?: "development" | "production" | "none";
  include?: RegExp;
  setDefaultValue?: boolean;
  sourcemap?: boolean;
  jsonOutputPath?: string;
  minimize?: boolean;
  outputPath?: string;
  libraryName?: string;
  target?: string;
  loaderOptions?: Record<string, any>;
  argMode?: "indexed" | "named";
  resolveAlias?: Record<string, string>;
  entry?: string;
};

/**
 * Factory function to create different webpack configurations for testing
 */
function createWebpackConfig(options: WebpackConfigOptions = {}): Configuration {
  const {
    configName = "default",
    mode = "development",
    include = /\.messages\.(ts|tsx)$/,
    setDefaultValue = false,
    sourcemap = true,
    jsonOutputPath = "locales/en.json",
    minimize = false,
    outputPath = "dist",
    libraryName = "TestBundle",
    target = "node",
    loaderOptions = {},
    argMode = "named",
    resolveAlias = {},
    entry = "./src/index.ts",
  } = options;

  return {
    name: configName,
    mode,
    entry,
    output: {
      path: path.resolve(__dirname, outputPath),
      filename: `bundle-${configName}.js`,
      clean: configName === "default", // Only clean on first build
      library: {
        name: libraryName,
        type: "commonjs2",
      },
    },
    optimization: {
      minimize,
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
      alias: resolveAlias,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: "ts-loader",
            },
            {
              loader: "i18next-auto-keys",
              options: {
                include,
                setDefaultValue,
                sourcemap,
                argMode,
                ...loaderOptions,
              },
            },
          ],
        },
      ],
    },
    plugins: [
      new I18nextAutoKeyEmitPlugin({
        jsonOutputPath: jsonOutputPath,
      }),
    ],
    devtool: sourcemap ? "source-map" : false,
    target,
  };
}

/**
 * Predefined test configurations
 *
 * NOTE: hashLength is now configured globally via cosmiconfig and defaults to 10.
 * Individual configurations no longer override this value.
 */
const TEST_CONFIGURATIONS = {
  default: createWebpackConfig({
    configName: "default",
    setDefaultValue: false,
  }),

  shortHashes: createWebpackConfig({
    configName: "short-hashes",
    setDefaultValue: false,
  }),

  longHashes: createWebpackConfig({
    configName: "long-hashes",
    setDefaultValue: false,
  }),

  withDefaultValues: createWebpackConfig({
    configName: "with-defaults",
    setDefaultValue: true,
  }),

  production: createWebpackConfig({
    configName: "production",
    mode: "production",
    minimize: true,
    sourcemap: false,
  }),

  strictInclude: createWebpackConfig({
    configName: "strict-include",
    include: /auth\.messages\.(ts|tsx)$/, // Only auth.messages.ts files
  }),

  noSourcemaps: createWebpackConfig({
    configName: "no-sourcemaps",
    sourcemap: false,
  }),

  customLoaderOptions: createWebpackConfig({
    configName: "custom-loader",
    setDefaultValue: true,
  }),

  indexedArguments: createWebpackConfig({
    configName: "indexed-arguments",
    argMode: "indexed",
    resolveAlias: {
      "./auth.messages": path.resolve(__dirname, "src/auth-indexed.messages.ts"),
      "./ui.messages": path.resolve(__dirname, "src/ui-indexed.messages.ts"),
    },
  }),

  translationContext: createWebpackConfig({
    configName: "translation-context",
    include: /(context|auth|ui)\.messages\.(ts|tsx)$/, // Include context, auth, and ui messages
  }),
};

export { createWebpackConfig, TEST_CONFIGURATIONS };
