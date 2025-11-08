import path from "path";
import { Volume } from "memfs";
import fs from "fs";

// Unmock loadConfig for this test file so we test the real implementation
jest.unmock("../loadConfig");
import { loadConfig } from "../loadConfig";

// Mock the package.json import
jest.mock("../../../../package.json", () => ({
  name: "i18next-auto-keys",
}));

// Mock fs for testing package.json reading
jest.mock("fs");

// Mock cosmiconfig to use our memory filesystem
const mockSearch = jest.fn();
jest.mock("cosmiconfig", () => ({
  cosmiconfigSync: jest.fn(() => ({
    search: mockSearch,
  })),
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe("loadConfig", () => {
  const originalCwd = process.cwd();
  let mockVolume: Volume;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVolume = new Volume();

    // Reset fs mocks to default behavior (no package.json found)
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  test("should load default configuration when no config file exists", () => {
    mockSearch.mockReturnValue(null);

    const result = loadConfig("/test/project");

    expect(result).toEqual({
      file: undefined,
      config: {
        poTemplateName: "messages.pot",
        poOutputDirectory: path.resolve("/test/project", "i18n"),
        hashLength: 10,
        argMode: "named",
        topLevelKey: undefined,
        projectId: "app 1.0",
        jsonIndentSpaces: 2,
      },
    });
  });

  test("should load and parse valid configuration file", () => {
    const configPath = "/test/project/.i18next-auto-keys.json";
    const mockConfig = {
      hashLength: 12,
      argMode: "indexed",
      poTemplateName: "template.pot",
      poOutputDirectory: "locales",
      projectId: "my-app v2.0",
      jsonIndentSpaces: 4,
      topLevelKey: "messages",
    };

    mockSearch.mockReturnValue({
      filepath: configPath,
      config: mockConfig,
    });

    const result = loadConfig("/test/project");

    expect(result).toEqual({
      file: configPath,
      config: {
        poTemplateName: "template.pot",
        poOutputDirectory: path.resolve("/test/project", "locales"),
        hashLength: 12,
        argMode: "indexed",
        topLevelKey: "messages",
        projectId: "my-app v2.0",
        jsonIndentSpaces: 4,
      },
    });
  });

  test("should merge partial configuration with defaults", () => {
    const mockConfig = {
      hashLength: 15,
      argMode: "indexed",
      // Other values should use defaults
    };

    mockSearch.mockReturnValue({
      filepath: "/test/project/i18next-auto-keys.config.js",
      config: mockConfig,
    });

    const result = loadConfig("/test/project");

    expect(result.config).toEqual({
      poTemplateName: "messages.pot",
      poOutputDirectory: path.resolve("/test/project", "i18n"),
      hashLength: 15,
      argMode: "indexed",
      topLevelKey: undefined,
      projectId: "app 1.0", // default
      jsonIndentSpaces: 2, // default
    });
  });

  test("should throw error for invalid hashLength", () => {
    const mockConfig = {
      hashLength: 5, // Too small, min is 10
    };

    mockSearch.mockReturnValue({
      filepath: "/test/project/package.json",
      config: mockConfig,
    });

    expect(() => loadConfig("/test/project")).toThrow();
  });

  test("should throw error for invalid argMode", () => {
    const mockConfig = {
      argMode: "invalid", // Must be "indexed" or "named"
    };

    mockSearch.mockReturnValue({
      filepath: "/test/project/package.json",
      config: mockConfig,
    });

    expect(() => loadConfig("/test/project")).toThrow();
  });

  test("should throw error for negative jsonIndentSpaces", () => {
    const mockConfig = {
      jsonIndentSpaces: -1, // Must be >= 0
    };

    mockSearch.mockReturnValue({
      filepath: "/test/project/package.json",
      config: mockConfig,
    });

    expect(() => loadConfig("/test/project")).toThrow();
  });

  test("should handle empty configuration object", () => {
    mockSearch.mockReturnValue({
      filepath: "/test/project/.i18next-auto-keysrc",
      config: {},
    });

    const result = loadConfig("/test/project");

    expect(result.config).toEqual({
      poTemplateName: "messages.pot",
      poOutputDirectory: path.resolve("/test/project", "i18n"),
      hashLength: 10,
      argMode: "named",
      topLevelKey: undefined,
      projectId: "app 1.0",
      jsonIndentSpaces: 2,
    });
  });

  test("should normalize relative poOutputDirectory to absolute path", () => {
    const mockConfig = {
      poOutputDirectory: "custom/path",
    };

    mockSearch.mockReturnValue({
      filepath: "/test/project/package.json",
      config: mockConfig,
    });

    const result = loadConfig("/test/project");

    expect(result.config.poOutputDirectory).toBe(path.resolve("/test/project", "custom/path"));
  });

  test("should handle absolute poOutputDirectory", () => {
    const absolutePath = "/absolute/path";
    const mockConfig = {
      poOutputDirectory: absolutePath,
    };

    mockSearch.mockReturnValue({
      filepath: "/test/project/package.json",
      config: mockConfig,
    });

    const result = loadConfig("/test/project");

    expect(result.config.poOutputDirectory).toBe(path.resolve("/test/project", absolutePath));
  });

  test("should use process.cwd() as default when no cwd provided", () => {
    const currentDir = process.cwd();
    mockSearch.mockReturnValue(null);

    const result = loadConfig();

    expect(mockSearch).toHaveBeenCalledWith(currentDir);
    expect(result.config.poOutputDirectory).toBe(path.resolve(currentDir, "i18n"));
  });

  describe("package.json based projectId defaults", () => {
    test("should use host project's package.json for default projectId", () => {
      mockSearch.mockReturnValue({
        filepath: "/test/project/.i18next-auto-keysrc",
        config: {},
      });

      // Mock package.json in the project directory
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === "/test/project/package.json";
      });

      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath === "/test/project/package.json") {
          return JSON.stringify({
            name: "my-awesome-app",
            version: "2.1.0",
          });
        }
        throw new Error("ENOENT: no such file or directory");
      });

      const result = loadConfig("/test/project");

      expect(result.config.projectId).toBe("my-awesome-app 2.1.0");
    });

    test("should fallback to 'app 1.0' when no package.json found", () => {
      mockSearch.mockReturnValue({
        filepath: "/test/project/.i18next-auto-keysrc",
        config: {},
      });

      // No package.json exists (default mock behavior)

      const result = loadConfig("/test/project");

      expect(result.config.projectId).toBe("app 1.0");
    });

    test("should fallback to 'app 1.0' when package.json is malformed", () => {
      mockSearch.mockReturnValue({
        filepath: "/test/project/.i18next-auto-keysrc",
        config: {},
      });

      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === "/test/project/package.json";
      });

      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath === "/test/project/package.json") {
          return "{ invalid json";
        }
        throw new Error("ENOENT: no such file or directory");
      });

      const result = loadConfig("/test/project");

      expect(result.config.projectId).toBe("app 1.0");
    });

    test("should fallback to 'app 1.0' when package.json missing name or version", () => {
      mockSearch.mockReturnValue({
        filepath: "/test/project/.i18next-auto-keysrc",
        config: {},
      });

      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === "/test/project/package.json";
      });

      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath === "/test/project/package.json") {
          return JSON.stringify({
            name: "my-app",
            // version missing
          });
        }
        throw new Error("ENOENT: no such file or directory");
      });

      const result = loadConfig("/test/project");

      expect(result.config.projectId).toBe("app 1.0");
    });

    test("should search upward for package.json", () => {
      mockSearch.mockReturnValue({
        filepath: "/test/project/src/.i18next-auto-keysrc",
        config: {},
      });

      // package.json exists in parent directory
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === "/test/project/package.json";
      });

      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath === "/test/project/package.json") {
          return JSON.stringify({
            name: "parent-project",
            version: "1.0.0",
          });
        }
        throw new Error("ENOENT: no such file or directory");
      });

      const result = loadConfig("/test/project/src");

      expect(result.config.projectId).toBe("parent-project 1.0.0");
    });

    test("should not override explicitly configured projectId", () => {
      mockSearch.mockReturnValue({
        filepath: "/test/project/.i18next-auto-keysrc",
        config: {
          projectId: "custom-project-id",
        },
      });

      // Mock package.json with different values
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === "/test/project/package.json";
      });

      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath === "/test/project/package.json") {
          return JSON.stringify({
            name: "some-other-app",
            version: "3.0.0",
          });
        }
        throw new Error("ENOENT: no such file or directory");
      });

      const result = loadConfig("/test/project");

      expect(result.config.projectId).toBe("custom-project-id");
    });
  });
});
