const path = require("path");
const typescript = require("@rollup/plugin-typescript");
const resolve = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const { i18nextAutoKeyRollupPlugin } = require("i18next-auto-keys");

module.exports = {
  input: path.resolve(__dirname, "fixtures/index.ts"),
  output: {
    dir: path.resolve(__dirname, "dist/rollup"),
    format: "cjs",
    entryFileNames: "bundle-default.js",
    sourcemap: true,
    exports: "named",
  },
  plugins: [
    resolve({
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    }),
    commonjs(),
    i18nextAutoKeyRollupPlugin({
      include: [/\.messages\.(ts|tsx)$/],
      setDefaultValue: false,
      sourcemap: true,
      argMode: "named",
      jsonOutputPath: "locales/en.json",
    }),
    typescript({
      tsconfig: path.resolve(__dirname, "tsconfig.json"),
      outDir: path.resolve(__dirname, "dist/rollup"),
    }),
  ],
};

