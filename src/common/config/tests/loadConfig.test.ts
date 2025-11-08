import path from "path";
import { Volume } from "memfs";

// Unmock loadConfig for this test file so we test the real implementation
jest.unmock("../loadConfig");
import { loadConfig } from "../loadConfig";

// Mock the package.json import
jest.mock("../../../../package.json", () => ({
  name: "i18next-auto-keys",
}));

// Mock cosmiconfig to use our memory filesystem
const mockSearch = jest.fn();
jest.mock("cosmiconfig", () => ({
  cosmiconfigSync: jest.fn(() => ({
    search: mockSearch,
  })),
}));

describe("loadConfig", () => {
  const originalCwd = process.cwd();
  let mockVolume: Volume;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVolume = new Volume();
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
});
