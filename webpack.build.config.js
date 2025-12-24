const pkg = require('./package.json');
const path = require('path');
const webpack = require('webpack');

// Create a base config function
const createConfig = (outputType) => ({
  mode: 'production',
  entry: {
    index: './src/index.ts',
    ...(outputType === 'cjs' ? { 'cli': './src/cli/cli.ts' } : {}),
  },
  target: 'node',
  experiments: {
    outputModule: outputType === 'esm',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: (pathData) => {
      // CLI always gets .js extension
      if (pathData.chunk.name === 'cli') {
        return 'cli.js';
      }
      // Index gets .cjs or .mjs based on output type
      return outputType === 'cjs' ? '[name].cjs' : '[name].mjs';
    },
    library: {
      type: outputType === 'esm' ? 'module' : 'commonjs2',
    },
    clean: outputType === 'cjs', // Only clean on first build
  },
  // Preserve shebang for CLI executables
  plugins: [
    new webpack.DefinePlugin({
      'process.env.PACKAGE_NAME': JSON.stringify(pkg.name),
      'process.env.PACKAGE_VERSION': JSON.stringify(pkg.version),
    }),
    ...(outputType === 'cjs' ? [{
      apply(compiler) {
        compiler.hooks.compilation.tap('BannerPlugin', (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: 'PreserveShebang',
              stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
            },
            () => {
              // Handle cli.js
              const cliAsset = compilation.assets['cli.js'];
              if (cliAsset) {
                const source = cliAsset.source();
                const newSource = '#!/usr/bin/env node\n' + source;
                compilation.updateAsset('cli.js', new compiler.webpack.sources.RawSource(newSource));
              }

              // Set executable permissions in a cross-platform way
              const fs = require('fs');
              const path = require('path');
              compiler.hooks.afterEmit.tap('SetExecutablePermissions', () => {
                const cliPath = path.resolve(__dirname, 'dist/cli.js');
                
                if (fs.existsSync(cliPath)) {
                  fs.chmodSync(cliPath, '755');
                }
              });
            }
          );
        });
      }
    }] : [])
  ],
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.build.json',
            transpileOnly: true,
            compilerOptions: {
              skipLibCheck: true,
            },
          },
        },
        exclude: [/node_modules/, /\.test\.ts$/, /tests/],
      },
    ],
  },
  devtool: 'hidden-source-map',
  externals: [
    {
      webpack: 'webpack',
      typescript: 'typescript',
      rollup: 'rollup',
      'gettext-parser': 'gettext-parser',
      // Keep external dependencies as externals instead of bundling them
      ...Object.keys(pkg.dependencies).reduce((acc, dep) => {
        acc[dep] = dep;
        return acc;
      }, {}),
    },
  ],
});

// Export both configs for parallel builds
module.exports = [
  createConfig('cjs'),  // CommonJS for Node.js and CLI
  createConfig('esm'),  // ESM for Vite and modern bundlers
];
