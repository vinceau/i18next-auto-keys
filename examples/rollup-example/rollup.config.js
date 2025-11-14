// Example Rollup configuration for i18next-auto-keys
import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript(),
    i18nextAutoKeyRollupPlugin({
      // Only process files matching this pattern
      include: [/\.messages\.ts$/],
      
      // Path where JSON translations will be emitted
      jsonOutputPath: 'locales/en.json',
      
      // Use named mode (default) - parameters use ICU named placeholders
      argMode: 'named',
    }),
  ],
};

