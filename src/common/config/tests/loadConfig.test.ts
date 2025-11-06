import path from "path";
import { Volume } from "memfs";
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
        potTemplatePath: path.resolve("/test/project", "i18n/messages.pot"),
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
      potTemplatePath: "locales/template.pot",
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
        potTemplatePath: path.resolve("/test/project", "locales/template.pot"),
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
      potTemplatePath: path.resolve("/test/project", "i18n/messages.pot"),
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
      potTemplatePath: path.resolve("/test/project", "i18n/messages.pot"),
      hashLength: 10,
      argMode: "named",
      topLevelKey: undefined,
      projectId: "app 1.0",
      jsonIndentSpaces: 2,
    });
  });

  test("should normalize relative potTemplatePath to absolute path", () => {
    const mockConfig = {
      potTemplatePath: "custom/path/messages.pot",
    };

    mockSearch.mockReturnValue({
      filepath: "/test/project/package.json",
      config: mockConfig,
    });

    const result = loadConfig("/test/project");

    expect(result.config.potTemplatePath).toBe(path.resolve("/test/project", "custom/path/messages.pot"));
  });

  test("should handle absolute potTemplatePath", () => {
    const absolutePath = "/absolute/path/to/messages.pot";
    const mockConfig = {
      potTemplatePath: absolutePath,
    };

    mockSearch.mockReturnValue({
      filepath: "/test/project/package.json",
      config: mockConfig,
    });

    const result = loadConfig("/test/project");

    expect(result.config.potTemplatePath).toBe(path.resolve("/test/project", absolutePath));
  });

  test("should use process.cwd() as default when no cwd provided", () => {
    const currentDir = process.cwd();
    mockSearch.mockReturnValue(null);

    const result = loadConfig();

    expect(mockSearch).toHaveBeenCalledWith(currentDir);
    expect(result.config.potTemplatePath).toBe(path.resolve(currentDir, "i18n/messages.pot"));
  });
});
