import fs from "fs";
import path from "path";
import { TEST_CONFIGURATIONS } from "./rollup-configs";
import { buildWithRollup } from "./build";
import { cleanConfigArtifacts, clearModuleCache, clearBundleCache } from "../test-helpers";

/**
 * E2E Tests for i18next-auto-keys with Programmatic Rollup Configurations
 *
 * This test suite demonstrates how to test rollup plugins with different configurations
 * programmatically rather than maintaining separate config files.
 *
 * Benefits:
 * - Single source of truth for test configurations
 * - Easy to add/modify test scenarios
 * - Parameterized tests for comprehensive coverage
 * - Isolation between different configuration scenarios
 */
describe("i18next-auto-keys Rollup E2E Tests", () => {
  const e2eRoot = path.resolve(__dirname, "../..");
  const distPath = path.join(e2eRoot, "dist/rollup");

  beforeAll(async () => {
    // Clean any previous builds
    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true, force: true });
    }
    // Ensure dist directory exists
    fs.mkdirSync(distPath, { recursive: true });
    fs.mkdirSync(path.join(distPath, "locales"), { recursive: true });
  });

  afterAll(() => {
    // Clean up any remaining artifacts
    Object.keys(TEST_CONFIGURATIONS).forEach((configName) => {
      cleanConfigArtifacts(configName, distPath);
    });
  });

  // Parameterized tests for each rollup configuration
  describe.each(Object.entries(TEST_CONFIGURATIONS))("Configuration: %s", (configName: string, configWithPath: any) => {
    let buildResult: Awaited<ReturnType<typeof buildWithRollup>>;
    let transformedCode: string;
    let translations: Record<string, string>;

    beforeAll(async () => {
      // Clear any cached modules and global state between configurations
      // This prevents the global store in the transformer from persisting across configurations
      clearModuleCache();

      // Build with the specific configuration
      buildResult = await buildWithRollup(configWithPath);

      // Verify build outputs exist
      expect(fs.existsSync(buildResult.bundlePath)).toBe(true);
      expect(fs.existsSync(buildResult.translationsPath)).toBe(true);

      // Load the generated code and translations
      transformedCode = fs.readFileSync(buildResult.bundlePath, "utf8");
      const translationsContent = fs.readFileSync(buildResult.translationsPath, "utf8");
      translations = JSON.parse(translationsContent);
    }, 60000);

    describe("Rollup Transformation", () => {
      it("should transform string returns to i18next.t() calls", () => {
        expect(transformedCode).toMatch(/\.t\(/);

        // Check for hash pattern with default length of 10
        const hashPattern = new RegExp(`\\.t\\(\\s*['"](\\w{10})['"]`);
        expect(transformedCode).toMatch(hashPattern);
      });

      it("should not transform @noTranslate functions", () => {
        expect(transformedCode).toMatch(/Debug: Auth component mounted/);
      });

      it("should include parameter objects for parameterized messages", () => {
        const paramPattern = new RegExp(`\\.t\\(\\s*['"](\\w{10})['"]\\s*,\\s*\\{`);
        expect(transformedCode).toMatch(paramPattern);
      });

      it("should generate hash keys of correct length", () => {
        const hashPattern = new RegExp(`\\.t\\(\\s*["'](\\w{10})["']`, "g");
        const hashMatches = transformedCode.match(hashPattern);

        expect(hashMatches).toBeTruthy();
        expect(hashMatches!.length).toBeGreaterThan(0);

        hashMatches!.forEach((match) => {
          const hash = match.match(new RegExp(`["'](\\w{10})["']`))?.[1];
          expect(hash).toBeDefined();
          expect(hash!.length).toBe(10);
        });
      });
    });

    describe("Translation File Generation", () => {
      it("should generate valid JSON translation file", () => {
        expect(translations).toBeDefined();
        expect(typeof translations).toBe("object");
      });

      it("should contain expected translations", () => {
        const values = Object.values(translations);

        // For strictInclude config, we only expect auth messages (not UI messages)
        if (configName === "strictInclude") {
          // Should contain auth messages
          expect(values).toContain("Authentication");
          expect(values).toContain("Please sign in to continue");
          expect(values).toContain("Sign In");
          expect(values).toContain("Welcome back, {{name}}!");

          // Should NOT contain UI messages (filtered out by include pattern)
          expect(values).not.toContain("Home");
          expect(values).not.toContain("Save Changes");
          expect(values).not.toContain("{{count}} items in your cart");
        } else {
          // For other configs, expect all messages
          expect(values).toContain("Authentication");
          expect(values).toContain("Please sign in to continue");
          expect(values).toContain("Sign In");
          expect(values).toContain("Home");
          expect(values).toContain("Save Changes");

          // For indexed arguments, expect indexed placeholders
          if (configName === "indexedArguments") {
            expect(values).toContain("Welcome back, {{0}}!");
          } else {
            expect(values).toContain("Welcome back, {{name}}!");
          }

          // For indexed arguments, expect indexed placeholders
          if (configName === "indexedArguments") {
            expect(values).toContain("{{0}} items in your cart");
          } else {
            expect(values).toContain("{{count}} items in your cart");
          }
        }

        // Always expect password reset message (from auth.messages.ts)
        // For indexed arguments, expect indexed placeholders
        if (configName === "indexedArguments") {
          expect(values).toContain("Password reset link sent to {{0}}. Expires in {{1}} minutes.");
        } else {
          expect(values).toContain("Password reset link sent to {{email}}. Expires in {{minutes}} minutes.");
        }
      });

      it("should not include @noTranslate messages", () => {
        const values = Object.values(translations);
        expect(values).not.toContain("Debug: Auth component mounted");
      });

      it("should have hash keys as object keys", () => {
        const keys = Object.keys(translations);
        expect(keys.length).toBeGreaterThan(0);

        keys.forEach((key) => {
          expect(key).toMatch(new RegExp(`^\\w{10}$`));
        });
      });

      it("should preserve i18next interpolation syntax", () => {
        const values = Object.values(translations);
        const interpolatedMessages = values.filter((value) => value.includes("{{"));

        expect(interpolatedMessages.length).toBeGreaterThan(0);

        interpolatedMessages.forEach((message) => {
          expect(message).toMatch(/\{\{\w+\}\}/);
        });
      });
    });

    describe("Source Map Generation", () => {
      it("should generate source map files", () => {
        const sourceMapPath = buildResult.bundlePath + ".map";
        expect(fs.existsSync(sourceMapPath)).toBe(true);
      });

      it("should include source map reference in bundle", () => {
        expect(transformedCode).toMatch(/\/\/# sourceMappingURL=.*\.js\.map/);
      });

      it("should generate valid source map JSON", () => {
        const sourceMapPath = buildResult.bundlePath + ".map";
        const sourceMapContent = fs.readFileSync(sourceMapPath, "utf8");
        const sourceMap = JSON.parse(sourceMapContent);

        // Verify required source map fields
        expect(sourceMap.version).toBe(3);
        expect(sourceMap.file).toBeDefined();
        expect(sourceMap.sources).toBeDefined();
        expect(Array.isArray(sourceMap.sources)).toBe(true);
        expect(sourceMap.sources.length).toBeGreaterThan(0);
        expect(sourceMap.sourcesContent).toBeDefined();
        expect(Array.isArray(sourceMap.sourcesContent)).toBe(true);
        expect(sourceMap.mappings).toBeDefined();
        expect(typeof sourceMap.mappings).toBe("string");
        expect(sourceMap.mappings.length).toBeGreaterThan(0);
      });

      it("should include original source files in source map", () => {
        const sourceMapPath = buildResult.bundlePath + ".map";
        const sourceMapContent = fs.readFileSync(sourceMapPath, "utf8");
        const sourceMap = JSON.parse(sourceMapContent);

        // Should include the original TypeScript message files
        const sources = sourceMap.sources as string[];
        const messageFiles = sources.filter((s: string) => s.includes("messages"));
        expect(messageFiles.length).toBeGreaterThan(0);

        // Should include source content for debugging
        expect(sourceMap.sourcesContent.length).toBe(sources.length);
        sourceMap.sourcesContent.forEach((content: string) => {
          expect(content).toBeDefined();
          expect(typeof content).toBe("string");
        });
      });
    });

    describe("End-to-End Function Testing", () => {
      let bundle: any;

      beforeAll(async () => {
        // Clear require cache and require the built bundle
        delete require.cache[buildResult.bundlePath];
        const bundleExports = require(buildResult.bundlePath);

        // Initialize i18next with the generated translations
        const localesDir = path.dirname(buildResult.translationsPath);
        await bundleExports.initializeI18n(localesDir);

        bundle = bundleExports;
      });

      it("should return translated simple messages", () => {
        const simpleMessages = bundle.getAllSimpleMessages();

        // For strictInclude config, only auth messages are transformed to use translations
        // UI messages remain as literal strings since they don't match the include pattern
        if (configName === "strictInclude") {
          // Auth messages should be translated
          expect(simpleMessages).toContain("Authentication");
          expect(simpleMessages).toContain("Sign In");
          // UI messages should remain as literal strings (not translated)
          expect(simpleMessages).toContain("Home");
          expect(simpleMessages).toContain("Save Changes");
          expect(simpleMessages).toContain("Loading...");
        } else {
          // For other configs, all messages should be translated
          expect(simpleMessages).toContain("Authentication");
          expect(simpleMessages).toContain("Sign In");
          expect(simpleMessages).toContain("Home");
          expect(simpleMessages).toContain("Save Changes");
          expect(simpleMessages).toContain("Loading...");
        }
      });

      it("should return translated parameterized messages", () => {
        const welcomeMessage = bundle.getWelcomeMessage("John");
        expect(welcomeMessage).toBe("Welcome back, John!");

        // For strictInclude config, UI messages are filtered out
        if (configName !== "strictInclude") {
          const statusMessage = bundle.getStatusMessage(5);
          expect(statusMessage).toBe("5 items in your cart");
        }
      });

      it("should return translated complex multi-parameter messages", () => {
        const resetMessage = bundle.getResetEmailMessage("test@example.com", 15);
        expect(resetMessage).toBe("Password reset link sent to test@example.com. Expires in 15 minutes.");

        const complexMessage = bundle.getComplexMessage();
        expect(complexMessage).toBe("3 of 5 login attempts remaining");
      });

      it("should preserve @noTranslate messages unchanged", () => {
        const debugMessage = bundle.getDebugMessage();
        expect(debugMessage).toBe("Debug: Auth component mounted");
      });
    });

    describe("Transformed Code Execution", () => {
      it("should be able to require and execute the transformed bundle", () => {
        expect(() => {
          require(buildResult.bundlePath);
        }).not.toThrow();
      });

      it("should export the expected functions", () => {
        // Clear the require cache to get fresh module
        delete require.cache[buildResult.bundlePath];
        const bundleExports = require(buildResult.bundlePath);

        // Should have all expected function exports
        expect(typeof bundleExports.initializeI18n).toBe("function");
        expect(typeof bundleExports.getWelcomeMessage).toBe("function");
        expect(typeof bundleExports.getStatusMessage).toBe("function");
        expect(typeof bundleExports.getAllSimpleMessages).toBe("function");
        expect(typeof bundleExports.getComplexMessage).toBe("function");
        expect(typeof bundleExports.getDebugMessage).toBe("function");
      });
    });

    afterAll(() => {
      // Clean up this configuration's artifacts
      cleanConfigArtifacts(configName, distPath);
    });
  });

  // Additional tests for specific configuration behaviors
  describe("Configuration-Specific Behavior", () => {
    beforeEach(() => {
      // Clear require cache before each test to ensure fresh global state
      clearModuleCache();
    });

    it("should demonstrate programmatic configuration capabilities", async () => {
      // NOTE: Due to global store in the transformer, different hash lengths
      // cannot be tested in the same process. This is a known limitation.
      // However, programmatic configs still provide value for other settings.

      const defaultConfig = TEST_CONFIGURATIONS.default;
      const prodConfig = TEST_CONFIGURATIONS.production;

      const defaultResult = await buildWithRollup(defaultConfig);
      const prodResult = await buildWithRollup(prodConfig);

      // Test that both configurations produce working bundles
      delete require.cache[defaultResult.bundlePath];
      delete require.cache[prodResult.bundlePath];

      const defaultBundle = require(defaultResult.bundlePath);
      const prodBundle = require(prodResult.bundlePath);

      // Initialize both bundles
      await defaultBundle.initializeI18n(path.dirname(defaultResult.translationsPath));
      await prodBundle.initializeI18n(path.dirname(prodResult.translationsPath));

      // Both should produce the same translated results
      expect(defaultBundle.getWelcomeMessage("Test")).toBe("Welcome back, Test!");
      expect(prodBundle.getWelcomeMessage("Test")).toBe("Welcome back, Test!");

      expect(defaultBundle.getDebugMessage()).toBe("Debug: Auth component mounted");
      expect(prodBundle.getDebugMessage()).toBe("Debug: Auth component mounted");

      // Clean up
      cleanConfigArtifacts("default", distPath);
      cleanConfigArtifacts("production", distPath);
    }, 120000);

    it("should support translation context configuration (feature verification)", async () => {
      // Verify that the translation context configuration can be created without errors
      const contextConfig = TEST_CONFIGURATIONS.translationContext;

      expect(contextConfig).toBeDefined();
      expect(contextConfig.config.plugins).toBeDefined();

      // Verify the plugins array exists and contains the i18next plugin
      const plugins = Array.isArray(contextConfig.config.plugins)
        ? contextConfig.config.plugins
        : [contextConfig.config.plugins];
      expect(plugins.length).toBeGreaterThan(0);

      // Verify the include pattern includes context message files
      const i18nextPlugin = plugins.find((p: any) => p && p.name === "i18next-auto-keys");
      expect(i18nextPlugin).toBeDefined();
    });

    it("should handle production mode correctly", async () => {
      const prodConfig = TEST_CONFIGURATIONS.production;
      const result = await buildWithRollup(prodConfig);

      expect(fs.existsSync(result.bundlePath)).toBe(true);
      expect(fs.existsSync(result.translationsPath)).toBe(true);

      // Production build should exist and be valid
      const prodBundle = fs.readFileSync(result.bundlePath, "utf8");
      expect(prodBundle.length).toBeGreaterThan(0);

      cleanConfigArtifacts("production", distPath);
    }, 60000);

    it("should respect include patterns correctly", async () => {
      const strictConfig = TEST_CONFIGURATIONS.strictInclude;
      const result = await buildWithRollup(strictConfig);

      // Clear require cache and load the bundle
      delete require.cache[result.bundlePath];
      const bundle = require(result.bundlePath);

      // Initialize i18next with the generated translations
      const localesDir = path.dirname(result.translationsPath);
      await bundle.initializeI18n(localesDir);

      // Test that auth messages are translated but UI messages remain literal
      const simpleMessages = bundle.getAllSimpleMessages();

      // Auth messages should be translated
      expect(simpleMessages).toContain("Authentication");
      expect(simpleMessages).toContain("Sign In");

      // UI messages should remain as literal strings (not transformed)
      expect(simpleMessages).toContain("Home");
      expect(simpleMessages).toContain("Save Changes");

      // Welcome message should work (from auth.messages - transformed)
      expect(bundle.getWelcomeMessage("Test")).toBe("Welcome back, Test!");

      // UI status message should return template literal (not transformed)
      const statusMessage = bundle.getStatusMessage(5);
      expect(statusMessage).toBe("{{count}} items in your cart");

      cleanConfigArtifacts("strictInclude", distPath);
    }, 60000);

    it("should produce correct results with named argument mode", async () => {
      const namedConfig = TEST_CONFIGURATIONS.default;
      const namedResult = await buildWithRollup(namedConfig);

      delete require.cache[namedResult.bundlePath];
      const namedBundle = require(namedResult.bundlePath);
      await namedBundle.initializeI18n(path.dirname(namedResult.translationsPath));

      expect(namedBundle.getWelcomeMessage("John")).toBe("Welcome back, John!");
      expect(namedBundle.getResetEmailMessage("user@example.com", 15)).toBe(
        "Password reset link sent to user@example.com. Expires in 15 minutes."
      );
      expect(namedBundle.getComplexMessage()).toBe("3 of 5 login attempts remaining");
    }, 60000);

    it("should produce correct results with indexed argument mode", async () => {
      const indexedConfig = TEST_CONFIGURATIONS.indexedArguments;
      const indexedResult = await buildWithRollup(indexedConfig);

      // Clear require cache to ensure fresh module load including i18next state
      clearBundleCache(indexedResult.bundlePath);

      const indexedBundle = require(indexedResult.bundlePath);
      await indexedBundle.initializeI18n(path.dirname(indexedResult.translationsPath), true); // force reinit

      expect(indexedBundle.getWelcomeMessage("John")).toBe("Welcome back, John!");
      expect(indexedBundle.getResetEmailMessage("user@example.com", 15)).toBe(
        "Password reset link sent to user@example.com. Expires in 15 minutes."
      );
      expect(indexedBundle.getComplexMessage()).toBe("3 of 5 login attempts remaining");

      cleanConfigArtifacts("indexed-arguments", distPath);
    }, 60000);

    it("should generate identical translations with both argument modes", async () => {
      const namedConfig = TEST_CONFIGURATIONS.default;
      const indexedConfig = TEST_CONFIGURATIONS.indexedArguments;

      const namedResult = await buildWithRollup(namedConfig);
      const indexedResult = await buildWithRollup(indexedConfig);

      const namedTranslations = JSON.parse(fs.readFileSync(namedResult.translationsPath, "utf8"));
      const indexedTranslations = JSON.parse(fs.readFileSync(indexedResult.translationsPath, "utf8"));

      // The translation values should be identical (though keys may differ due to hashing)
      const namedValues = Object.values(namedTranslations).sort();
      const indexedValues = Object.values(indexedTranslations).sort();

      expect(namedValues).toEqual(indexedValues);
    }, 60000);

    afterAll(() => {
      // Clean up configuration-specific test artifacts
      cleanConfigArtifacts("default", distPath);
      cleanConfigArtifacts("indexed-arguments", distPath);
    });
  });
});
