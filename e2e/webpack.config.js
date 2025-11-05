const path = require('path');
const { I18nextAutoKeyEmitPlugin } = require('../dist/index.js');

module.exports = {
  mode: 'development',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
    library: {
      name: 'TestBundle',
      type: 'commonjs2',
    },
  },
  optimization: {
    minimize: false, // Don't minify for easier testing
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          },
          {
            loader: path.resolve(__dirname, '../dist/index.js'),
            options: {
              include: /\.messages\.(ts|tsx)$/,
              hashLength: 10,
              setDefaultValue: false,
              sourcemap: true,
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new I18nextAutoKeyEmitPlugin({
      jsonOutputPath: 'locales/en.json',
    }),
  ],
  devtool: 'source-map',
  target: 'node', // For testing environment
};
