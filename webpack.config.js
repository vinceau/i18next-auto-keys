// webpack.config.js
module.exports = {
    // ...
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: require.resolve("i18next-icu-loader/dist/loader.js"),
              options: { include: /\.[jt]sx?$/, sourcemap: true },
            },
          ],
        },
      ],
    },
    devtool: "source-map",
  };
  