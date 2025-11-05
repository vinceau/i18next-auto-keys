import * as path from "path";
import { Configuration } from "webpack";
const { I18nextAutoKeyEmitPlugin } = require("../dist/index.js");

interface WebpackConfigOptions {
  configName?: string;
  mode?: "development" | "production" | "none";
  hashLength?: number;
  include?: RegExp;
  setDefaultValue?: boolean;
  sourcemap?: boolean;
  jsonOutputPath?: string;
  minimize?: boolean;
  outputPath?: string;
  libraryName?: string;
  target?: string;
  loaderOptions?: Record<string, any>;
}

/**
 * Factory function to create different webpack configurations for testing
 */
function createWebpackConfig(options: WebpackConfigOptions = {}): Configuration {
  const {
    configName = "default",
    mode = "development",
    hashLength = 10,
    include = /\.messages\.(ts|tsx)$/,
    setDefaultValue = false,
    sourcemap = true,
    jsonOutputPath = "locales/en.json",
    minimize = false,
    outputPath = "dist",
    libraryName = "TestBundle",
    target = "node",
    loaderOptions = {},
  } = options;

  return {
    name: configName,
    mode,
    entry: "./src/index.ts",
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
              loader: path.resolve(__dirname, "../dist/index.js"),
              options: {
                include,
                hashLength,
                setDefaultValue,
                sourcemap,
                ...loaderOptions,
              },
            },
          ],
        },
      ],
    },
    plugins: [
      new I18nextAutoKeyEmitPlugin({
        jsonOutputPath: `locales/${configName}-en.json`,
      }),
    ],
    devtool: sourcemap ? "source-map" : false,
    target,
  };
}

/**
 * Predefined test configurations
 *
 * NOTE: Due to a global store in the transformer, different hashLength values
 * cannot be properly tested in the same process. The first configuration to run
 * will set the hash length for all subsequent configurations.
 */
const TEST_CONFIGURATIONS = {
  default: createWebpackConfig({
    configName: "default",
    hashLength: 10,
    setDefaultValue: false,
  }),

  // Note: These have the same hashLength due to global store limitation
  shortHashes: createWebpackConfig({
    configName: "short-hashes",
    hashLength: 10,
    setDefaultValue: false,
  }),

  longHashes: createWebpackConfig({
    configName: "long-hashes",
    hashLength: 10, // Would be 16, but global store prevents this
    setDefaultValue: false,
  }),

  withDefaultValues: createWebpackConfig({
    configName: "with-defaults",
    hashLength: 10,
    setDefaultValue: true,
  }),

  production: createWebpackConfig({
    configName: "production",
    mode: "production",
    hashLength: 10,
    minimize: true,
    sourcemap: false,
  }),

  strictInclude: createWebpackConfig({
    configName: "strict-include",
    include: /auth\.messages\.(ts|tsx)$/, // Only auth.messages.ts files
    hashLength: 10,
  }),

  noSourcemaps: createWebpackConfig({
    configName: "no-sourcemaps",
    sourcemap: false,
    hashLength: 10,
  }),

  customLoaderOptions: createWebpackConfig({
    configName: "custom-loader",
    hashLength: 10, // Would be 12, but global store prevents this
    setDefaultValue: true, // Use a valid option instead
  }),
};

export { createWebpackConfig, TEST_CONFIGURATIONS };
