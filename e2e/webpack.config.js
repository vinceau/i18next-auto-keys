const path = require("path");
const { I18nextAutoKeyEmitPlugin } = require("i18next-auto-keys");

module.exports = {
  name: "default",
  mode: "development",
  entry: path.resolve(__dirname, "fixtures/index.ts"),
  output: {
    path: path.resolve(__dirname, "dist/webpack"),
    filename: "bundle-default.js",
    clean: true,
    library: {
      name: "TestBundle",
      type: "commonjs2",
    },
  },
  optimization: {
    minimize: false,
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
            options: {
              configFile: path.resolve(__dirname, "tsconfig.json"),
            },
          },
          {
            loader: "i18next-auto-keys",
            options: {
              include: /\.messages\.(ts|tsx)$/,
              setDefaultValue: false,
              sourcemap: true,
              argMode: "named",
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new I18nextAutoKeyEmitPlugin({
      jsonOutputPath: path.resolve(__dirname, "dist/webpack/locales/en.json"),
    }),
  ],
  devtool: "source-map",
  target: "node",
};

