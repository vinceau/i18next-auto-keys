// webpack.config.js
const path = require('path');

module.exports = {
    // ...
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
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
  