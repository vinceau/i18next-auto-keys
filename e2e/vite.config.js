import path from "path";
import { defineConfig } from "vite";
import { i18nextAutoKeyRollupPlugin } from "i18next-auto-keys";

/**
 * Example Vite configuration for i18next-auto-keys
 * 
 * This demonstrates how to use the i18nextAutoKeyRollupPlugin with Vite.
 * The plugin works seamlessly with Vite because Vite uses Rollup under the hood
 * for production builds and supports Rollup plugins.
 * 
 * Usage:
 *   vite build --config vite.config.js
 */
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "fixtures/index.ts"),
      formats: ["cjs"],
      fileName: () => "bundle-default.js",
    },
    outDir: path.resolve(__dirname, "dist/vite"),
    sourcemap: true,
    rollupOptions: {
      external: ["i18next", "i18next-icu", "fs", "path"],
      output: {
        exports: "named",
      },
    },
  },
  plugins: [
    i18nextAutoKeyRollupPlugin({
      // Pattern to match message files
      include: [/\.messages\.(ts|tsx)$/],
      
      // Use named arguments (parameter names match function parameters)
      argMode: "named",
      
      // Don't include defaultValue in t() calls (saves bundle size)
      setDefaultValue: false,
      
      // Output path for generated translations
      jsonOutputPath: "locales/en.json",
      
      // Optional: wrap translations under a top-level key
      // topLevelKey: "translation",
    }),
  ],
});

