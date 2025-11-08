import fs from "fs";
import path from "path";
import { loadConfig } from "../../dist/index";

/**
 * Simplified E2E Tests for Configuration System
 *
 * These tests verify that the configuration system works correctly
 * in a real filesystem environment.
 */

describe("Configuration System Simplified E2E Tests", () => {
  const testWorkspace = path.join(__dirname, "../temp-simple-config-test");

  beforeAll(() => {
    // Create test workspace
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
    fs.mkdirSync(testWorkspace, { recursive: true });
  });

  afterAll(() => {
    // Clean up test workspace
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clear any config files and subdirectories before each test
    const configFiles = [".i18next-auto-keysrc.json", "package.json"];
    configFiles.forEach((file) => {
      const filePath = path.join(testWorkspace, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    // Clean up any subdirectories created by tests
    const subDirs = ["isolated", "src"];
    subDirs.forEach((dir) => {
      const dirPath = path.join(testWorkspace, dir);
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    });
  });

  describe("Default Configuration", () => {
    test("should use fallback projectId when no package.json exists", () => {
      // Ensure no package.json exists in test workspace or parent directories
      // by testing in a deeply nested temporary directory
      const isolatedTestDir = path.join(testWorkspace, "isolated", "deep", "nested");
      fs.mkdirSync(isolatedTestDir, { recursive: true });

      const result = loadConfig(isolatedTestDir);

      expect(result.file).toBeUndefined();
      expect(result.config).toEqual({
        poTemplateName: "messages.pot",
        poOutputDirectory: path.resolve(isolatedTestDir, "i18n"),
        hashLength: 10,
        argMode: "named",
        topLevelKey: undefined,
        projectId: "app 1.0", // Should fallback to default
        jsonIndentSpaces: 2,
      });
    });

    test("should use package.json for projectId when found", () => {
      // Create a package.json in the test workspace
      const packageJsonContent = {
        name: "test-e2e-project",
        version: "2.5.0",
        description: "Test project for e2e testing",
      };

      const packageJsonPath = path.join(testWorkspace, "package.json");
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonContent, null, 2));

      const result = loadConfig(testWorkspace);

      expect(result.file).toBeUndefined(); // No i18next-auto-keys config file
      expect(result.config).toEqual({
        poTemplateName: "messages.pot",
        poOutputDirectory: path.resolve(testWorkspace, "i18n"),
        hashLength: 10,
        argMode: "named",
        topLevelKey: undefined,
        projectId: "test-e2e-project 2.5.0", // Should use package.json values
        jsonIndentSpaces: 2,
      });
    });

    test("should search upward for package.json", () => {
      // Create package.json in parent directory
      const packageJsonContent = {
        name: "parent-e2e-project",
        version: "1.2.3",
      };

      const packageJsonPath = path.join(testWorkspace, "package.json");
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonContent, null, 2));

      // Test from a subdirectory
      const subDir = path.join(testWorkspace, "src", "components");
      fs.mkdirSync(subDir, { recursive: true });

      const result = loadConfig(subDir);

      expect(result.file).toBeUndefined();
      expect(result.config.projectId).toBe("parent-e2e-project 1.2.3");
    });
  });

  describe("JSON Configuration File", () => {
    test("should respect custom hashLength in JSON config", () => {
      const config = {
        hashLength: 15,
        argMode: "named",
      };

      const configPath = path.join(testWorkspace, ".i18next-auto-keysrc.json");
      fs.writeFileSync(configPath, JSON.stringify(config));

      const result = loadConfig(testWorkspace);

      expect(result.file).toBe(configPath);
      expect(result.config.hashLength).toBe(15);
      expect(result.config.argMode).toBe("named");
    });

    test("should respect argMode configuration", () => {
      const config = {
        hashLength: 12,
        argMode: "indexed",
      };

      const configPath = path.join(testWorkspace, ".i18next-auto-keysrc.json");
      fs.writeFileSync(configPath, JSON.stringify(config));

      const result = loadConfig(testWorkspace);

      expect(result.config.argMode).toBe("indexed");
      expect(result.config.hashLength).toBe(12);
    });

    test("should handle all configuration options", () => {
      const config = {
        hashLength: 20,
        argMode: "indexed",
        poTemplateName: "messages.pot",
        poOutputDirectory: "custom/path",
        projectId: "test-project v1.0",
        jsonIndentSpaces: 4,
        topLevelKey: "messages",
      };

      const configPath = path.join(testWorkspace, ".i18next-auto-keysrc.json");
      fs.writeFileSync(configPath, JSON.stringify(config));

      const result = loadConfig(testWorkspace);

      expect(result.config).toEqual({
        hashLength: 20,
        argMode: "indexed",
        poTemplateName: "messages.pot",
        poOutputDirectory: path.resolve(testWorkspace, "custom/path"),
        projectId: "test-project v1.0",
        jsonIndentSpaces: 4,
        topLevelKey: "messages",
      });
    });
  });

  describe("Package.json Configuration", () => {
    test("should load configuration from package.json", () => {
      const packageJsonContent = {
        name: "test-project",
        version: "1.0.0",
        "i18next-auto-keys": {
          hashLength: 16,
          argMode: "indexed",
        },
      };

      const packageJsonPath = path.join(testWorkspace, "package.json");
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonContent, null, 2));

      const result = loadConfig(testWorkspace);

      expect(result.file).toBe(packageJsonPath);
      expect(result.config.hashLength).toBe(16);
      expect(result.config.argMode).toBe("indexed");
      // Should still use package.json name/version for projectId when no explicit projectId in config
      expect(result.config.projectId).toBe("test-project 1.0.0");
    });

    test("should override package.json projectId when explicitly configured", () => {
      const packageJsonContent = {
        name: "background-project",
        version: "9.9.9",
        "i18next-auto-keys": {
          hashLength: 12,
          projectId: "custom-override-project v1.5",
        },
      };

      const packageJsonPath = path.join(testWorkspace, "package.json");
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonContent, null, 2));

      const result = loadConfig(testWorkspace);

      expect(result.file).toBe(packageJsonPath);
      expect(result.config.hashLength).toBe(12);
      // Should use explicitly configured projectId, not package name/version
      expect(result.config.projectId).toBe("custom-override-project v1.5");
    });
  });

  describe("Configuration Validation", () => {
    test("should reject invalid hashLength", () => {
      const config = {
        hashLength: 5, // Too small, minimum is 10
      };

      const configPath = path.join(testWorkspace, ".i18next-auto-keysrc.json");
      fs.writeFileSync(configPath, JSON.stringify(config));

      expect(() => loadConfig(testWorkspace)).toThrow();
    });

    test("should reject invalid argMode", () => {
      const config = {
        argMode: "invalid",
      };

      const configPath = path.join(testWorkspace, ".i18next-auto-keysrc.json");
      fs.writeFileSync(configPath, JSON.stringify(config));

      expect(() => loadConfig(testWorkspace)).toThrow();
    });

    test("should reject negative jsonIndentSpaces", () => {
      const config = {
        jsonIndentSpaces: -1,
      };

      const configPath = path.join(testWorkspace, ".i18next-auto-keysrc.json");
      fs.writeFileSync(configPath, JSON.stringify(config));

      expect(() => loadConfig(testWorkspace)).toThrow();
    });
  });

  describe("Configuration Precedence", () => {
    test("should prioritize package.json over rc files (cosmiconfig precedence)", () => {
      // Create both config files
      const packageJsonContent = {
        name: "test-project",
        version: "1.0.0",
        "i18next-auto-keys": {
          hashLength: 11,
          argMode: "named",
        },
      };

      const dedicatedConfig = {
        hashLength: 17,
        argMode: "indexed",
      };

      const packageJsonPath = path.join(testWorkspace, "package.json");
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonContent, null, 2));

      const dedicatedConfigPath = path.join(testWorkspace, ".i18next-auto-keysrc.json");
      fs.writeFileSync(dedicatedConfigPath, JSON.stringify(dedicatedConfig));

      const result = loadConfig(testWorkspace);

      // Should use package.json (cosmiconfig precedence: package.json > rc files)
      expect(result.file).toBe(packageJsonPath);
      expect(result.config.hashLength).toBe(11);
      expect(result.config.argMode).toBe("named");
    });
  });
});
