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
              loader: require.resolve("i18next-auto-keys"),
              options: { include: /\.[jt]sx?$/, sourcemap: true },
            },
          ],
        },
      ],
    },
    devtool: "source-map",
  };
  