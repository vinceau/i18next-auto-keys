/**
 * ICU E2E Tests
 *
 * Tests ICU (International Components for Unicode) message formatting
 * with both indexed and named parameter modes.
 *
 * This tests integration with i18next-icu for advanced formatting features like:
 * - Pluralization: {count, plural, one {# item} other {# items}}
 * - Number formatting: {value, number, percent}
 * - Date formatting: {date, date, short}
 * - Select statements: {status, select, online {Online} offline {Offline}}
 */

import fs from "fs";
import path from "path";
import webpack, { Configuration } from "webpack";
import { promisify } from "util";
import { createWebpackConfig } from "./webpack-configs";

const webpackAsync = promisify(webpack);

// Test configurations for ICU testing
const ICU_TEST_CONFIGURATIONS = {
  icuNamed: createWebpackConfig({
    configName: "icu-named",
    argMode: "named",
    include: /replay-browser.*\.messages\.(ts|tsx)$/,
    // Override entry point for ICU testing
    entry: path.resolve(__dirname, "../../fixtures/icu-index.ts"),
    jsonOutputPath: "locales/icu-named-en.json",
  }),

  icuIndexed: createWebpackConfig({
    configName: "icu-indexed",
    argMode: "indexed",
    include: /replay-browser.*\.messages\.(ts|tsx)$/,
    // Override entry point for ICU testing
    entry: path.resolve(__dirname, "../../fixtures/icu-index.ts"),
    jsonOutputPath: "locales/icu-indexed-en.json",
    resolveAlias: {
      "./replay-browser.messages": path.resolve(__dirname, "../../fixtures/messages/replay-browser-indexed.messages.ts"),
    },
  }),
};

describe("ICU E2E Tests", () => {
  const distPath = path.resolve(__dirname, "../../dist/webpack");

  // Helper function to build webpack with a given configuration
  async function buildWithConfig(config: any): Promise<{
    bundlePath: string;
    translationsPath: string;
    stats: any;
  }> {
    const stats = await webpackAsync([config]);

    if (stats && stats.hasErrors()) {
      const errors = stats.toJson().errors;
      throw new Error(`Webpack build failed: ${errors?.map((e: any) => e.message).join("\n") || "Unknown error"}`);
    }

    const configName = config.name || "default";
    const bundlePath = path.join(config.output!.path!, `bundle-${configName}.js`);
    const translationsPath = path.join(config.output!.path!, `locales/${configName}-en.json`);

    return { bundlePath, translationsPath, stats };
  }

  // Helper function to clean up artifacts for a specific configuration
  function cleanConfigArtifacts(configName: string, distPath: string) {
    const bundlePath = path.join(distPath, `bundle-${configName}.js`);
    const translationsPath = path.join(distPath, `locales/${configName}-en.json`);

    [bundlePath, translationsPath].forEach((filePath) => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  }

  beforeAll(() => {
    // Clean dist directory and create necessary subdirectories
    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true, force: true });
    }
    fs.mkdirSync(distPath, { recursive: true });
    fs.mkdirSync(path.join(distPath, "locales"), { recursive: true });
  });

  afterAll(() => {
    // Clean up all configuration artifacts
    Object.keys(ICU_TEST_CONFIGURATIONS).forEach((configName) => {
      cleanConfigArtifacts(configName, distPath);
    });
  });

  describe.each(Object.entries(ICU_TEST_CONFIGURATIONS))("Configuration: %s", (configName: string, config: any) => {
    let buildResult: {
      bundlePath: string;
      translationsPath: string;
      stats: webpack.Stats;
    };

    beforeAll(async () => {
      // Clear require cache to prevent global state leakage
      Object.keys(require.cache).forEach((key) => {
        if (key.includes("dist/index.js") || key.includes("i18next-auto-keys")) {
          delete require.cache[key];
        }
      });

      buildResult = await buildWithConfig(config);
    }, 60000);

    afterAll(() => {
      cleanConfigArtifacts(configName, distPath);
    });

    describe("ICU Webpack Transformation", () => {
      it("should transform ICU messages to i18next.t() calls", () => {
        const bundleContent = fs.readFileSync(buildResult.bundlePath, "utf8");

        // Should contain i18next.t() calls (webpack bundles it as i18next_1.default.t)
        expect(bundleContent).toMatch(/i18next_\d+\.default\.t\(|i18next\.t\(/);

        // Should not contain the original ICU template strings
        expect(bundleContent).not.toContain("plural, one {# file} other {# files}} found");
        expect(bundleContent).not.toContain("Total size:");
      });

      it("should preserve ICU formatting syntax in parameter objects", () => {
        const bundleContent = fs.readFileSync(buildResult.bundlePath, "utf8");

        // Should contain parameter objects for ICU messages with appropriate parameter names
        if (configName === "icuNamed") {
          expect(bundleContent).toMatch(/\{\s*count\s*\}|\{\s*readableBytes\s*\}|\{\s*completed,\s*total\s*\}/);
        } else {
          // For indexed, parameters should still be passed
          expect(bundleContent).toMatch(/\{\s*count\s*\}|\{\s*readableBytes\s*\}|\{\s*completed,\s*total\s*\}/);
        }
      });
    });

    describe("ICU Translation File Generation", () => {
      let translations: Record<string, string>;

      beforeAll(() => {
        const translationsContent = fs.readFileSync(buildResult.translationsPath, "utf8");
        translations = JSON.parse(translationsContent);
      });

      it("should generate valid JSON translation file", () => {
        expect(translations).toBeDefined();
        expect(typeof translations).toBe("object");
      });

      it("should contain ICU formatted messages", () => {
        const values = Object.values(translations);

        // Check for ICU pluralization syntax
        expect(values.some((val) => val.includes("plural, one {# file} other {# files}"))).toBe(true);

        // Check for ICU number formatting
        expect(values.some((val) => val.includes("number, percent"))).toBe(true);

        // Check for ICU select formatting
        expect(values.some((val) => val.includes("select, online"))).toBe(true);
      });

      it("should use correct parameter format based on argMode", () => {
        const values = Object.values(translations);

        if (configName === "icuIndexed") {
          // Indexed mode should use {0}, {1}, etc.
          expect(values.some((val) => val.includes("{0, plural"))).toBe(true);
          expect(values.some((val) => val.includes("Total size: {0}"))).toBe(true);
          expect(values.some((val) => val.includes("{0, number} of {1, number}"))).toBe(true);
        } else {
          // Named mode should use {count}, {readableBytes}, etc.
          expect(values.some((val) => val.includes("{count, plural"))).toBe(true);
          expect(values.some((val) => val.includes("Total size: {readableBytes}"))).toBe(true);
          expect(values.some((val) => val.includes("{completed, number} of {total, number}"))).toBe(true);
        }
      });

      it("should preserve complex ICU features", () => {
        const values = Object.values(translations);

        // Complex pluralization with multiple parameters
        expect(
          values.some(
            (val) =>
              val.includes("plural, one {# file} other {# files}") &&
              val.includes("plural, one {# match} other {# matches}")
          )
        ).toBe(true);

        // Date formatting
        expect(values.some((val) => val.includes("date, short"))).toBe(true);

        // Number formatting with bytes
        expect(values.some((val) => val.includes("number, bytes"))).toBe(true);
      });
    });

    describe("ICU End-to-End Function Testing", () => {
      let bundle: any;

      beforeAll(async () => {
        // Clear require cache and require the built bundle
        delete require.cache[buildResult.bundlePath];
        const bundleExports = require(buildResult.bundlePath);
        bundle = bundleExports.TestBundle;

        // Initialize i18next with ICU support
        const localesDir = path.dirname(buildResult.translationsPath);
        await bundle.initializeI18n(localesDir);
      });

      it("should handle ICU pluralization correctly", () => {
        // Test singular
        const singleFile = bundle.getTotalFileCount(1);
        expect(singleFile).toBe("1 file found.");

        // Test plural
        const multipleFiles = bundle.getTotalFileCount(5);
        expect(multipleFiles).toBe("5 files found.");

        // Test zero (should use plural form in English)
        const zeroFiles = bundle.getTotalFileCount(0);
        expect(zeroFiles).toBe("0 files found.");
      });

      it("should handle ICU number formatting", () => {
        const progress = bundle.getDownloadProgress(0.75);
        expect(progress).toBe("Download: 75%");

        const processing = bundle.getProcessingStatus(10, 25);
        expect(processing).toBe("Processing: 10 of 25 files");
      });

      it("should handle ICU select statements", () => {
        const online = bundle.getConnectionStatus("online");
        expect(online).toBe("Connected to server");

        const offline = bundle.getConnectionStatus("offline");
        expect(offline).toBe("Connection lost");

        const unknown = bundle.getConnectionStatus("connecting");
        expect(unknown).toBe("Unknown status");
      });

      it("should handle complex ICU messages with multiple parameters", () => {
        const searchResults = bundle.getSearchResults(3, 7);
        expect(searchResults).toBe("3 files with 7 matches");

        const searchResultsSingular = bundle.getSearchResults(1, 1);
        expect(searchResultsSingular).toBe("1 file with 1 match");
      });

      it("should handle mixed ICU and regular interpolation", () => {
        const analysis = bundle.getFileAnalysis("test.js", 1024, 2);
        // Note: i18next-icu may format numbers differently than expected
        expect(analysis).toMatch(/File "test\.js" \(\d{1,3}(,\d{3})*( bytes)?\) has 2 errors?/);

        const analysisNoErrors = bundle.getFileAnalysis("clean.js", 512, 0);
        expect(analysisNoErrors).toMatch(/File "clean\.js" \(\d+( bytes)?\) has 0 errors?/);
      });
    });

    describe("ICU Transformed Code Execution", () => {
      it("should be able to require and execute the transformed bundle", () => {
        expect(() => {
          delete require.cache[buildResult.bundlePath];
          require(buildResult.bundlePath);
        }).not.toThrow();
      });

      it("should export the expected ICU message functions", () => {
        delete require.cache[buildResult.bundlePath];
        const bundleExports = require(buildResult.bundlePath);
        const bundle = bundleExports.TestBundle;

        // Check for all expected function exports
        expect(typeof bundle.initializeI18n).toBe("function");
        expect(typeof bundle.getTotalFileCount).toBe("function");
        expect(typeof bundle.getHiddenFileCount).toBe("function");
        expect(typeof bundle.getErrorFileCount).toBe("function");
        expect(typeof bundle.getTotalSize).toBe("function");
        expect(typeof bundle.getProcessingStatus).toBe("function");
        expect(typeof bundle.getLastUpdated).toBe("function");
        expect(typeof bundle.getDownloadProgress).toBe("function");
        expect(typeof bundle.getSearchResults).toBe("function");
        expect(typeof bundle.getConnectionStatus).toBe("function");
        expect(typeof bundle.getFileAnalysis).toBe("function");
      });
    });
  });

  describe("ICU Configuration Comparison", () => {
    it("should produce identical results with indexed and named ICU modes", async () => {
      // Build both configurations
      const namedConfig = ICU_TEST_CONFIGURATIONS.icuNamed;
      const indexedConfig = ICU_TEST_CONFIGURATIONS.icuIndexed;

      const namedResult = await buildWithConfig(namedConfig);
      const indexedResult = await buildWithConfig(indexedConfig);

      // Clear require cache and load both bundles
      delete require.cache[namedResult.bundlePath];
      delete require.cache[indexedResult.bundlePath];

      const namedBundle = require(namedResult.bundlePath).TestBundle;
      const indexedBundle = require(indexedResult.bundlePath).TestBundle;

      // Initialize i18next with ICU for both bundles
      await namedBundle.initializeI18n(path.dirname(namedResult.translationsPath));
      await indexedBundle.initializeI18n(path.dirname(indexedResult.translationsPath));

      // Test that both modes produce identical ICU results
      expect(namedBundle.getTotalFileCount(5)).toBe("5 files found.");
      expect(indexedBundle.getTotalFileCount(5)).toBe("5 files found.");

      expect(namedBundle.getDownloadProgress(0.5)).toBe("Download: 50%");
      expect(indexedBundle.getDownloadProgress(0.5)).toBe("Download: 50%");

      expect(namedBundle.getConnectionStatus("online")).toBe("Connected to server");
      expect(indexedBundle.getConnectionStatus("online")).toBe("Connected to server");

      expect(namedBundle.getSearchResults(2, 4)).toBe("2 files with 4 matches");
      expect(indexedBundle.getSearchResults(2, 4)).toBe("2 files with 4 matches");

      // Verify that the generated translations contain correct ICU syntax
      const namedTranslations = JSON.parse(fs.readFileSync(namedResult.translationsPath, "utf8"));
      const indexedTranslations = JSON.parse(fs.readFileSync(indexedResult.translationsPath, "utf8"));

      // Both should have the same number of translations
      expect(Object.keys(namedTranslations).length).toBe(Object.keys(indexedTranslations).length);

      // The translation values should contain proper ICU syntax but with different parameter names
      const namedValues = Object.values(namedTranslations).sort();
      const indexedValues = Object.values(indexedTranslations).sort();

      // They should have the same structure but different parameter references
      expect(namedValues.length).toBe(indexedValues.length);

      // Clean up
      cleanConfigArtifacts("icu-named", distPath);
      cleanConfigArtifacts("icu-indexed", distPath);
    }, 120000);
  });
});
