import { jest } from "@jest/globals";
import fs from "fs";
import { extractKeysAndGeneratePotFile } from "../extract";
import { i18nStore } from "../../../common/i18nStore";

// Mock console to avoid spam during tests
const mockConsole = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

// Mock file system
jest.mock("fs");

const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock glob
jest.mock("glob", () => ({
  sync: jest.fn(() => []),
}));

// Get the mocked module
const glob = require("glob");
const mockGlob = glob;

// Mock gettext-parser with realistic POT content
const mockGettextParser = {
  po: {
    compile: jest.fn((catalog: any) => {
      // Generate realistic POT content based on the catalog
      const projectId = catalog.headers["project-id-version"] || "app 1.0";
      const generator = catalog.headers["x-generator"] || "i18next-auto-keys CLI";

      let potContent = `# POT file
msgid ""
msgstr ""
"Project-Id-Version: ${projectId}\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"x-generator: ${generator}\\n"

`;

      // Add entries from the catalog
      if (catalog.translations && catalog.translations[""]) {
        for (const [msgid, entry] of Object.entries(catalog.translations[""])) {
          if (msgid !== "") {
            // Skip header entry
            const entryData = entry as any;

            // Add reference comments if present
            if (entryData.comments?.reference) {
              const refLines = entryData.comments.reference.split("\n");
              for (const line of refLines) {
                potContent += `#: ${line}\n`;
              }
            }

            // Add extracted comments if present
            if (entryData.comments?.extracted) {
              const extractedLines = entryData.comments.extracted.split("\n");
              for (const line of extractedLines) {
                if (line.trim()) {
                  potContent += `#. ${line}\n`;
                }
              }
            }

            potContent += `msgctxt "${entryData.msgctxt}"
msgid "${msgid}"
msgstr ""

`;
          }
        }
      }

      return Buffer.from(potContent, "utf8");
    }),
  },
};

jest.mock("../../loadGettextParser", () => ({
  loadGettextParser: jest.fn(() => Promise.resolve(mockGettextParser)),
}));

describe("extractKeysAndGeneratePotFile", () => {
  const testSourceDir = "/test/src";
  const testOutputPath = "/test/output/messages.pot";

  beforeEach(() => {
    jest.clearAllMocks();
    i18nStore.clear();

    // Mock console methods to reduce test output noise
    console.log = mockConsole.log;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;

    // Mock file system defaults
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.mkdirSync.mockReturnValue(undefined as any);
    mockedFs.writeFileSync.mockReturnValue(undefined);

    // Mock tsconfig.json to avoid parsing errors
    (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
      const pathStr = filePath.toString();
      if (pathStr.includes("tsconfig.json")) {
        return JSON.stringify({
          compilerOptions: {
            target: "ES2020",
            module: "commonjs",
            strict: true,
          },
        });
      }
      return mockFileContent(pathStr);
    });

    function mockFileContent(pathStr: string) {
      if (pathStr.includes("ui.messages.ts")) {
        return `export const Messages = {
  greeting: (): string => "Hello, world!",
  farewell: (): string => "Goodbye!"
};`;
      }
      if (pathStr.includes("Button.messages.tsx")) {
        return `export const ButtonMessages = {
  clickMe: (): string => "Click me!",
  loading: (): string => "Loading..."
};`;
      }
      return "export const NoMessages = {};";
    }

    // Mock glob to return test files that match .messages pattern
    mockGlob.sync.mockReturnValue(["/test/src/ui.messages.ts", "/test/src/components/Button.messages.tsx"]);
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  it("should generate POT file successfully", async () => {
    // Use .messages.ts pattern to match what the transformer expects
    await extractKeysAndGeneratePotFile({
      source: testSourceDir,
      output: testOutputPath,
      include: ["**/*.messages.ts", "**/*.messages.tsx"],
      projectId: "test-app 1.0",
    });

    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(testOutputPath, expect.any(Buffer));

    // Verify POT content structure
    const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
      (call) => call[0] === testOutputPath
    )?.[1] as Buffer;

    expect(potBuffer).toBeInstanceOf(Buffer);
    const potContent = potBuffer.toString();

    // Should contain project header
    expect(potContent).toContain("Project-Id-Version: test-app 1.0");
    expect(potContent).toContain("x-generator: i18next-auto-keys CLI");

    // Should contain the extracted messages
    expect(potContent).toContain("Hello, world!");
    expect(potContent).toContain("Goodbye!");
    expect(potContent).toContain("Click me!");
    expect(potContent).toContain("Loading...");
  });

  it("should create output directory if it doesn't exist", async () => {
    const outputDir = "/test/output";
    mockedFs.existsSync.mockImplementation((filePath) => {
      return filePath !== outputDir;
    });

    await extractKeysAndGeneratePotFile({
      source: testSourceDir,
      output: testOutputPath,
      include: ["**/*.ts"],
    });

    expect(mockedFs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(testOutputPath, expect.any(Buffer));
  });

  it("should handle custom include/exclude patterns", async () => {
    const customInclude = ["**/*.custom.ts"];
    const customExclude = ["**/ignored/**"];

    await extractKeysAndGeneratePotFile({
      source: testSourceDir,
      output: testOutputPath,
      include: customInclude,
      exclude: customExclude,
    });

    expect(mockGlob.sync).toHaveBeenCalledWith("**/*.custom.ts", {
      cwd: testSourceDir,
      absolute: true,
      ignore: customExclude,
    });
  });

  it("should handle missing tsconfig gracefully", async () => {
    mockedFs.existsSync.mockImplementation((filePath) => {
      return !filePath.toString().includes("tsconfig.json");
    });

    await extractKeysAndGeneratePotFile({
      source: testSourceDir,
      output: testOutputPath,
      include: ["**/*.ts"],
    });

    // Should still process files even without tsconfig
    expect(mockedFs.readFileSync).toHaveBeenCalled();
  });

  it("should warn when no source files are found", async () => {
    mockGlob.sync.mockReturnValue([]);

    await extractKeysAndGeneratePotFile({
      source: testSourceDir,
      output: testOutputPath,
      include: ["**/*.ts"],
    });

    expect(mockConsole.warn).toHaveBeenCalledWith("⚠️  No source files found matching the criteria");
    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("should handle file processing errors gracefully", async () => {
    (mockedFs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error("File read error");
    });

    await extractKeysAndGeneratePotFile({
      source: testSourceDir,
      output: testOutputPath,
      include: ["**/*.ts"],
    });

    expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining("❌ Error processing"), expect.any(Error));
  });

  describe("JSDoc parameter metadata extraction", () => {
    it("should include parameter metadata when JSDoc is available for all parameters", async () => {
      // Mock file with full JSDoc for all parameters
      (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
        const pathStr = filePath.toString();
        if (pathStr.includes("tsconfig.json")) {
          return JSON.stringify({
            compilerOptions: {
              target: "ES2020",
              module: "commonjs",
              strict: true,
            },
          });
        }
        if (pathStr.includes("jsdoc-full.messages.ts")) {
          return `export const JSDocMessages = {
  /**
   * Greets a user with their name and age
   * @param name The user's display name
   * @param age The user's age in years
   */
  greeting: (name: string, age: number): string => "Hello {name}, you are {age} years old!",
};`;
        }
        return "export const NoMessages = {};";
      });

      mockGlob.sync.mockReturnValue(["/test/src/jsdoc-full.messages.ts"]);

      await extractKeysAndGeneratePotFile({
        source: testSourceDir,
        output: testOutputPath,
        include: ["**/*.messages.ts"],
        projectId: "test-jsdoc 1.0",
      });

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(testOutputPath, expect.any(Buffer));

      // Verify POT content includes JSDoc parameter metadata
      const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
        (call) => call[0] === testOutputPath
      )?.[1] as Buffer;

      expect(potBuffer).toBeInstanceOf(Buffer);
      const potContent = potBuffer.toString();

      // Should contain parameter metadata with JSDoc available in comments
      expect(potContent).toContain("{0} = name");
      expect(potContent).toContain("{1} = age");
      expect(potContent).toContain("Hello {name}, you are {age} years old!");
      // JSDoc should be present in the comments
      expect(potContent).toContain("@param name The user's display name");
      expect(potContent).toContain("@param age The user's age in years");
    });

    it("should include parameter metadata when no JSDoc is available", async () => {
      // Mock file with no JSDoc
      (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
        const pathStr = filePath.toString();
        if (pathStr.includes("tsconfig.json")) {
          return JSON.stringify({
            compilerOptions: {
              target: "ES2020",
              module: "commonjs",
              strict: true,
            },
          });
        }
        if (pathStr.includes("no-jsdoc.messages.ts")) {
          return `export const NoJSDocMessages = {
  status: (count: number, total: number): string => "Processing {count} of {total} files",
  userInfo: (username: string, email: string): string => "User: {username} ({email})",
};`;
        }
        return "export const NoMessages = {};";
      });

      mockGlob.sync.mockReturnValue(["/test/src/no-jsdoc.messages.ts"]);

      await extractKeysAndGeneratePotFile({
        source: testSourceDir,
        output: testOutputPath,
        include: ["**/*.messages.ts"],
        projectId: "test-no-jsdoc 1.0",
      });

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(testOutputPath, expect.any(Buffer));

      // Verify POT content includes parameter names without descriptions
      const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
        (call) => call[0] === testOutputPath
      )?.[1] as Buffer;

      expect(potBuffer).toBeInstanceOf(Buffer);
      const potContent = potBuffer.toString();

      // Should contain parameter metadata without JSDoc descriptions
      expect(potContent).toContain("{0} = count");
      expect(potContent).toContain("{1} = total");
      expect(potContent).toContain("{0} = username");
      expect(potContent).toContain("{1} = email");
      expect(potContent).toContain("Processing {count} of {total} files");
      expect(potContent).toContain("User: {username} ({email})");
    });

    it("should handle mixed JSDoc availability (some parameters documented, some not)", async () => {
      // Mock file with partial JSDoc
      (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
        const pathStr = filePath.toString();
        if (pathStr.includes("tsconfig.json")) {
          return JSON.stringify({
            compilerOptions: {
              target: "ES2020",
              module: "commonjs",
              strict: true,
            },
          });
        }
        if (pathStr.includes("mixed-jsdoc.messages.ts")) {
          return `export const MixedJSDocMessages = {
  /**
   * Shows file analysis results
   * @param fileName The name of the file being analyzed
   * @param errors The number of errors found (this parameter is documented)
   */
  fileAnalysis: (fileName: string, size: number, errors: number): string =>
    "File {fileName} ({size} bytes) has {errors} errors",
};`;
        }
        return "export const NoMessages = {};";
      });

      mockGlob.sync.mockReturnValue(["/test/src/mixed-jsdoc.messages.ts"]);

      await extractKeysAndGeneratePotFile({
        source: testSourceDir,
        output: testOutputPath,
        include: ["**/*.messages.ts"],
        projectId: "test-mixed-jsdoc 1.0",
      });

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(testOutputPath, expect.any(Buffer));

      // Verify POT content includes both documented and undocumented parameters
      const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
        (call) => call[0] === testOutputPath
      )?.[1] as Buffer;

      expect(potBuffer).toBeInstanceOf(Buffer);
      const potContent = potBuffer.toString();

      // Should contain parameter metadata with mixed documentation
      expect(potContent).toContain("{0} = fileName");
      expect(potContent).toContain("{1} = size"); // No JSDoc for size parameter
      expect(potContent).toContain("{2} = errors");
      expect(potContent).toContain("File {fileName} ({size} bytes) has {errors} errors");
      // JSDoc should be present in the comments for documented parameters
      expect(potContent).toContain("@param fileName The name of the file being analyzed");
      expect(potContent).toContain("@param errors The number of errors found");
    });

    it("should handle functions with no parameters", async () => {
      // Mock file with functions that have no parameters
      (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
        const pathStr = filePath.toString();
        if (pathStr.includes("tsconfig.json")) {
          return JSON.stringify({
            compilerOptions: {
              target: "ES2020",
              module: "commonjs",
              strict: true,
            },
          });
        }
        if (pathStr.includes("no-params.messages.ts")) {
          return `export const NoParamsMessages = {
  /**
   * A simple welcome message
   */
  welcome: (): string => "Welcome to our application!",
  loading: (): string => "Loading...",
};`;
        }
        return "export const NoMessages = {};";
      });

      mockGlob.sync.mockReturnValue(["/test/src/no-params.messages.ts"]);

      await extractKeysAndGeneratePotFile({
        source: testSourceDir,
        output: testOutputPath,
        include: ["**/*.messages.ts"],
        projectId: "test-no-params 1.0",
      });

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(testOutputPath, expect.any(Buffer));

      // Verify POT content does not include parameter metadata for parameterless functions
      const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
        (call) => call[0] === testOutputPath
      )?.[1] as Buffer;

      expect(potBuffer).toBeInstanceOf(Buffer);
      const potContent = potBuffer.toString();

      // Should not contain parameter metadata lines
      expect(potContent).not.toContain("{0}");
      expect(potContent).not.toContain("{1}");
      expect(potContent).toContain("Welcome to our application!");
      expect(potContent).toContain("Loading...");
      // May contain JSDoc comments but not parameter-specific metadata
      expect(potContent).toContain("A simple welcome message");
    });
  });
});
