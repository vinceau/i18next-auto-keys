import * as fs from "fs";
import * as path from "path";
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
    // Clear any config files before each test
    const configFiles = [
      ".i18next-auto-keysrc.json",
      ".i18next-auto-keysrc.js", 
      "i18next-auto-keys.config.js",
      "package.json"
    ];
    configFiles.forEach(file => {
      const filePath = path.join(testWorkspace, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });

  describe("Default Configuration", () => {
    test("should use default configuration when no config file exists", () => {
      const result = loadConfig(testWorkspace);

      expect(result.file).toBeUndefined();
      expect(result.config).toEqual({
        potTemplatePath: path.resolve(testWorkspace, "i18n/messages.pot"),
        hashLength: 10,
        argMode: "named",
        topLevelKey: undefined,
        projectId: "app 1.0",
        jsonIndentSpaces: 2,
      });
    });
  });

  describe("JSON Configuration File", () => {
    test("should respect custom hashLength in JSON config", () => {
      const config = {
        hashLength: 15,
        argMode: "named"
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
        argMode: "indexed"
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
        potTemplatePath: "custom/path/messages.pot",
        projectId: "test-project v1.0",
        jsonIndentSpaces: 4,
        topLevelKey: "messages"
      };

      const configPath = path.join(testWorkspace, ".i18next-auto-keysrc.json");
      fs.writeFileSync(configPath, JSON.stringify(config));

      const result = loadConfig(testWorkspace);

      expect(result.config).toEqual({
        hashLength: 20,
        argMode: "indexed",
        potTemplatePath: path.resolve(testWorkspace, "custom/path/messages.pot"),
        projectId: "test-project v1.0", 
        jsonIndentSpaces: 4,
        topLevelKey: "messages"
      });
    });
  });

  describe("JavaScript Configuration File", () => {
    test("should load JS configuration file", () => {
      const configContent = `module.exports = {
        hashLength: 14,
        argMode: "named"
      };`;

      const configPath = path.join(testWorkspace, "i18next-auto-keys.config.js");
      fs.writeFileSync(configPath, configContent);

      // Verify file was written
      expect(fs.existsSync(configPath)).toBe(true);

      const result = loadConfig(testWorkspace);

      expect(result.file).toBe(configPath);
      expect(result.config.hashLength).toBe(14);
      expect(result.config.argMode).toBe("named");
    });
  });

  describe("Package.json Configuration", () => {
    test("should load configuration from package.json", () => {
      const packageJsonContent = {
        "name": "test-project",
        "version": "1.0.0",
        "i18next-auto-keys": {
          hashLength: 16,
          argMode: "indexed"
        }
      };

      const packageJsonPath = path.join(testWorkspace, "package.json");
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonContent, null, 2));

      const result = loadConfig(testWorkspace);

      expect(result.file).toBe(packageJsonPath);
      expect(result.config.hashLength).toBe(16);
      expect(result.config.argMode).toBe("indexed");
    });
  });

  describe("Configuration Validation", () => {
    test("should reject invalid hashLength", () => {
      const config = {
        hashLength: 5 // Too small, minimum is 10
      };

      const configPath = path.join(testWorkspace, ".i18next-auto-keysrc.json");
      fs.writeFileSync(configPath, JSON.stringify(config));

      expect(() => loadConfig(testWorkspace)).toThrow();
    });

    test("should reject invalid argMode", () => {
      const config = {
        argMode: "invalid"
      };

      const configPath = path.join(testWorkspace, ".i18next-auto-keysrc.json");
      fs.writeFileSync(configPath, JSON.stringify(config));

      expect(() => loadConfig(testWorkspace)).toThrow();
    });

    test("should reject negative jsonIndentSpaces", () => {
      const config = {
        jsonIndentSpaces: -1
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
        "name": "test-project",
        "version": "1.0.0", 
        "i18next-auto-keys": {
          hashLength: 11,
          argMode: "named"
        }
      };

      const dedicatedConfig = {
        hashLength: 17,
        argMode: "indexed"
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
