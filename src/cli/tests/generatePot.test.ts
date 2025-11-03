import { jest } from "@jest/globals";
import fs from "fs";
import { generatePotFile } from "../generatePot";
import { i18nStore } from "../../common/i18nStore";

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

jest.mock("../loadGettextParser", () => ({
  loadGettextParser: jest.fn(() => Promise.resolve(mockGettextParser)),
}));

describe("generatePotFile", () => {
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
    await generatePotFile({
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

    await generatePotFile({
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

    await generatePotFile({
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

    await generatePotFile({
      source: testSourceDir,
      output: testOutputPath,
      include: ["**/*.ts"],
    });

    // Should still process files even without tsconfig
    expect(mockedFs.readFileSync).toHaveBeenCalled();
  });

  it("should warn when no source files are found", async () => {
    mockGlob.sync.mockReturnValue([]);

    await generatePotFile({
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

    await generatePotFile({
      source: testSourceDir,
      output: testOutputPath,
      include: ["**/*.ts"],
    });

    expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining("❌ Error processing"), expect.any(Error));
  });
});
