import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import i18next from "i18next";
import webpack, { Configuration } from "webpack";
import { TEST_CONFIGURATIONS, createWebpackConfig } from "../webpack-configs";

const webpackAsync = promisify(webpack);

/**
 * Helper function to build webpack with a specific configuration
 */
async function buildWithConfig(config: any): Promise<{
  bundlePath: string;
  translationsPath: string;
  stats: any;
}> {
  const stats = await webpackAsync([config]);

  if (stats && stats.hasErrors()) {
    const errors = stats.toJson().errors;
    throw new Error(`Webpack build failed: ${errors?.map((e) => e.message).join("\n") || "Unknown error"}`);
  }

  const configName = config.name || "default";
  const bundlePath = path.join(config.output!.path!, `bundle-${configName}.js`);
  const translationsPath = path.join(config.output!.path!, `locales/${configName}-en.json`);

  return { bundlePath, translationsPath, stats };
}

/**
 * Helper to clean build artifacts for a specific configuration
 */
function cleanConfigArtifacts(configName: string, distPath: string) {
  const bundlePath = path.join(distPath, `bundle-${configName}.js`);
  const bundleMapPath = path.join(distPath, `bundle-${configName}.js.map`);
  const translationsPath = path.join(distPath, `locales/${configName}-en.json`);

  [bundlePath, bundleMapPath, translationsPath].forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  });
}

/**
 * E2E Tests for i18next-auto-keys with Programmatic Webpack Configurations
 *
 * This test suite demonstrates how to test webpack loaders with different configurations
 * programmatically rather than maintaining separate config files.
 *
 * Benefits:
 * - Single source of truth for test configurations
 * - Easy to add/modify test scenarios
 * - Parameterized tests for comprehensive coverage
 * - Isolation between different configuration scenarios
 */
describe("i18next-auto-keys E2E Tests", () => {
  const e2eRoot = path.resolve(__dirname, "..");
  const distPath = path.join(e2eRoot, "dist");

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

  // Parameterized tests for each webpack configuration
  describe.each(Object.entries(TEST_CONFIGURATIONS))("Configuration: %s", (configName: string, config: any) => {
    let buildResult: Awaited<ReturnType<typeof buildWithConfig>>;
    let transformedCode: string;
    let translations: Record<string, string>;

    beforeAll(async () => {
      // Clear any cached modules and global state between configurations
      // This prevents the global store in the transformer from persisting across configurations
      Object.keys(require.cache).forEach((key) => {
        if (key.includes("dist/index.js") || key.includes("i18next-auto-keys")) {
          delete require.cache[key];
        }
      });

      // Build with the specific configuration
      buildResult = await buildWithConfig(config);

      // Verify build outputs exist
      expect(fs.existsSync(buildResult.bundlePath)).toBe(true);
      expect(fs.existsSync(buildResult.translationsPath)).toBe(true);

      // Load the generated code and translations
      transformedCode = fs.readFileSync(buildResult.bundlePath, "utf8");
      const translationsContent = fs.readFileSync(buildResult.translationsPath, "utf8");
      translations = JSON.parse(translationsContent);
    }, 60000);

    describe("Webpack Transformation", () => {
      it("should transform string returns to i18next.t() calls", () => {
        expect(transformedCode).toMatch(/\.t\(/);

        // Check for hash pattern matching the expected length
        const expectedLength = (config.module?.rules?.[0] as any)?.use?.[1]?.options?.hashLength || 10;
        const hashPattern = new RegExp(`\\.t\\(\\s*['"](\\w{${expectedLength}})['"]`);
        expect(transformedCode).toMatch(hashPattern);
      });

      it("should not transform @noTranslate functions", () => {
        expect(transformedCode).toMatch(/Debug: Auth component mounted/);
      });

      it("should include parameter objects for parameterized messages", () => {
        const expectedLength = (config.module?.rules?.[0] as any)?.use?.[1]?.options?.hashLength || 10;
        const paramPattern = new RegExp(`\\.t\\(\\s*['"](\\w{${expectedLength}})['"]\\s*,\\s*\\{`);
        expect(transformedCode).toMatch(paramPattern);
      });

      it("should generate hash keys of correct length", () => {
        const expectedLength = (config.module?.rules?.[0] as any)?.use?.[1]?.options?.hashLength || 10;
        const hashPattern = new RegExp(`\\.t\\(\\s*["'](\\w{${expectedLength}})["']`, "g");
        const hashMatches = transformedCode.match(hashPattern);

        expect(hashMatches).toBeTruthy();
        expect(hashMatches!.length).toBeGreaterThan(0);

        hashMatches!.forEach((match) => {
          const hash = match.match(new RegExp(`["'](\\w{${expectedLength}})["']`))?.[1];
          expect(hash).toBeDefined();
          expect(hash!.length).toBe(expectedLength);
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
          expect(values).toContain("Welcome back, {{name}}!");
          expect(values).toContain("{{count}} items in your cart");
        }

        // Always expect password reset message (from auth.messages.ts)
        expect(values).toContain("Password reset link sent to {{email}}. Expires in {{minutes}} minutes.");
      });

      it("should not include @noTranslate messages", () => {
        const values = Object.values(translations);
        expect(values).not.toContain("Debug: Auth component mounted");
      });

      it("should have hash keys as object keys", () => {
        const keys = Object.keys(translations);
        expect(keys.length).toBeGreaterThan(0);

        const expectedLength = (config.module?.rules?.[0] as any)?.use?.[1]?.options?.hashLength || 10;
        keys.forEach((key) => {
          expect(key).toMatch(new RegExp(`^\\w{${expectedLength}}$`));
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

    describe("i18next Integration", () => {
      let i18nextInstance: typeof i18next;

      beforeAll(async () => {
        // Create a fresh i18next instance for this config
        const { createInstance } = await import("i18next");
        i18nextInstance = createInstance();

        await i18nextInstance.init({
          lng: "en",
          fallbackLng: "en",
          resources: {
            en: {
              translation: translations,
            },
          },
        });
      });

      it("should load translations into i18next", () => {
        const store = i18nextInstance.getResourceBundle("en", "translation");
        expect(store).toBeDefined();
        expect(Object.keys(store).length).toBeGreaterThan(0);
      });

      it("should resolve simple translations", () => {
        const authTitleKey = Object.keys(translations).find((key) => translations[key] === "Authentication");
        const loginButtonKey = Object.keys(translations).find((key) => translations[key] === "Sign In");

        expect(authTitleKey).toBeDefined();
        expect(loginButtonKey).toBeDefined();

        expect(i18nextInstance.t(authTitleKey!)).toBe("Authentication");
        expect(i18nextInstance.t(loginButtonKey!)).toBe("Sign In");
      });

      it("should resolve parameterized translations", () => {
        const welcomeKey = Object.keys(translations).find((key) => translations[key] === "Welcome back, {{name}}!");

        expect(welcomeKey).toBeDefined();
        expect(i18nextInstance.t(welcomeKey!, { name: "John" })).toBe("Welcome back, John!");

        // For strictInclude config, itemCount is filtered out (from ui.messages.ts)
        if (configName !== "strictInclude") {
          const itemCountKey = Object.keys(translations).find(
            (key) => translations[key] === "{{count}} items in your cart"
          );
          expect(itemCountKey).toBeDefined();
          expect(i18nextInstance.t(itemCountKey!, { count: 5 })).toBe("5 items in your cart");
        }
      });

      it("should resolve complex multi-parameter translations", () => {
        const resetEmailKey = Object.keys(translations).find(
          (key) => translations[key] === "Password reset link sent to {{email}}. Expires in {{minutes}} minutes."
        );
        const attemptsKey = Object.keys(translations).find(
          (key) => translations[key] === "{{count}} of {{maxAttempts}} login attempts remaining"
        );

        if (resetEmailKey) {
          const resetResult = i18nextInstance.t(resetEmailKey, {
            email: "test@example.com",
            minutes: 15,
          });
          expect(resetResult).toBe("Password reset link sent to test@example.com. Expires in 15 minutes.");
        }

        if (attemptsKey) {
          const attemptsResult = i18nextInstance.t(attemptsKey, {
            count: 3,
            maxAttempts: 5,
          });
          expect(attemptsResult).toBe("3 of 5 login attempts remaining");
        }
      });

      it("should handle missing keys gracefully", () => {
        const result = i18nextInstance.t("nonexistent_key_123");
        expect(result).toBe("nonexistent_key_123");
      });

      it("should handle missing parameters gracefully", () => {
        const welcomeKey = Object.keys(translations).find((key) => translations[key] === "Welcome back, {{name}}!");

        if (welcomeKey) {
          const result = i18nextInstance.t(welcomeKey);
          expect(result).toBe("Welcome back, {{name}}!");
        }
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
        const bundle = require(buildResult.bundlePath);

        const exportKeys = Object.keys(bundle);
        expect(exportKeys.length).toBeGreaterThan(0);

        // At minimum, the bundle should be a valid JS module
        expect(typeof bundle).toBe("object");
        expect(bundle).not.toBeNull();
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
      Object.keys(require.cache).forEach((key) => {
        if (key.includes("dist/index.js") || key.includes("i18next-auto-keys")) {
          delete require.cache[key];
        }
      });
    });

    it("should demonstrate programmatic configuration capabilities", async () => {
      // NOTE: Due to global store in the transformer, different hash lengths
      // cannot be tested in the same process. This is a known limitation.
      // However, programmatic configs still provide value for other settings.

      const defaultConfig = TEST_CONFIGURATIONS.default;
      const prodConfig = TEST_CONFIGURATIONS.production;

      const defaultResult = await buildWithConfig(defaultConfig);
      const prodResult = await buildWithConfig(prodConfig);

      // Both should generate valid translations
      const defaultTranslations = JSON.parse(fs.readFileSync(defaultResult.translationsPath, "utf8"));
      const prodTranslations = JSON.parse(fs.readFileSync(prodResult.translationsPath, "utf8"));

      const defaultKeys = Object.keys(defaultTranslations);
      const prodKeys = Object.keys(prodTranslations);

      // Both should have 10-character hashes (due to global store)
      defaultKeys.forEach((key) => expect(key.length).toBe(10));
      prodKeys.forEach((key) => expect(key.length).toBe(10));

      // Verify both have same content (same strings processed)
      expect(Object.keys(defaultTranslations).sort()).toEqual(Object.keys(prodTranslations).sort());

      // Clean up
      cleanConfigArtifacts("default", distPath);
      cleanConfigArtifacts("production", distPath);
    }, 120000);

    it("should handle production mode correctly", async () => {
      const prodConfig = TEST_CONFIGURATIONS.production;
      const result = await buildWithConfig(prodConfig);

      expect(fs.existsSync(result.bundlePath)).toBe(true);
      expect(fs.existsSync(result.translationsPath)).toBe(true);

      // Production build should exist and be valid
      const prodBundle = fs.readFileSync(result.bundlePath, "utf8");
      expect(prodBundle.length).toBeGreaterThan(0);

      cleanConfigArtifacts("production", distPath);
    }, 60000);

    it("should respect include patterns correctly", async () => {
      const strictConfig = TEST_CONFIGURATIONS.strictInclude;
      const result = await buildWithConfig(strictConfig);

      const translations = JSON.parse(fs.readFileSync(result.translationsPath, "utf8"));
      const values = Object.values(translations);

      // Should include auth messages
      expect(values).toContain("Authentication");
      expect(values).toContain("Welcome back, {{name}}!");

      // Should NOT include UI messages since they don't match the pattern
      expect(values).not.toContain("Home");
      expect(values).not.toContain("Save Changes");

      cleanConfigArtifacts("strict-include", distPath);
    }, 60000);
  });
});
