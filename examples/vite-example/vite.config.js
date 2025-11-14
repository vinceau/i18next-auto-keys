// Example Vite configuration for i18next-auto-keys
import { defineConfig } from 'vite';
import { i18nextAutoKeyRollupPlugin } from 'i18next-auto-keys';

export default defineConfig({
  plugins: [
    i18nextAutoKeyRollupPlugin({
      // Only process files matching this pattern
      include: [/\.messages\.(ts|tsx)$/],
      
      // Path where JSON translations will be emitted
      jsonOutputPath: 'locales/en.json',
      
      // Use original strings as fallback in development (useful for HMR)
      setDefaultValue: process.env.NODE_ENV === 'development',
      
      // Wrap transformed strings with ~~ markers for visual debugging
      debug: process.env.NODE_ENV === 'development',
    }),
  ],
});

