const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    index: './src/index.ts',
    'cli/generatePot': './src/cli/generatePot.ts'
  },
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    library: {
      type: 'commonjs2',
    },
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.build.json',
          },
        },
        exclude: [/node_modules/, /\.test\.ts$/, /tests/],
      },
    ],
  },
  devtool: 'source-map',
  externals: [
    // Keep external dependencies as externals instead of bundling them
    {
      'schema-utils': 'schema-utils',
      webpack: 'webpack',
      typescript: 'typescript',
      'gettext-parser': 'gettext-parser',
      commander: 'commander',
      glob: 'glob',
    },
    // For the CLI bundle, make index.js external to avoid duplication
    function ({ context, request }, callback) {
      const isCliBuild = context && context.includes('cli');

      if (isCliBuild) {
        // Make main index external for CLI to reuse shared functionality
        if (request === '../index') {
          return callback(null, 'commonjs2 ../index');
        }
      }
      callback();
    }
  ],
};
