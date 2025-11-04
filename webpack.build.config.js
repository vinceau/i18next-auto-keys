const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    index: './src/index.ts',
    'cli/cli': './src/cli/cli.ts'
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
  // Preserve shebang for CLI executables
  plugins: [
    {
      apply(compiler) {
        compiler.hooks.compilation.tap('BannerPlugin', (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: 'PreserveShebang',
              stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
            },
            () => {
              // Handle cli.js
              const cliAsset = compilation.assets['cli/cli.js'];
              if (cliAsset) {
                const source = cliAsset.source();
                const newSource = '#!/usr/bin/env node\n' + source;
                compilation.updateAsset('cli/cli.js', new compiler.webpack.sources.RawSource(newSource));
              }

              // Set executable permissions in a cross-platform way
              const fs = require('fs');
              const path = require('path');
              compiler.hooks.afterEmit.tap('SetExecutablePermissions', () => {
                const cliPath = path.resolve(__dirname, 'dist/cli/cli.js');
                
                if (fs.existsSync(cliPath)) {
                  fs.chmodSync(cliPath, '755');
                }
              });
            }
          );
        });
      }
    }
  ],
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
