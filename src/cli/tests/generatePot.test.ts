import { jest } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import { generatePotFile } from "../generatePot";
import { i18nStore } from "../../common/i18nStore";

// Mock file system
jest.mock("fs");
jest.mock("glob");

const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock glob to return test files
const mockGlob = jest.createMockFromModule("glob") as any;
mockGlob.sync = jest.fn();

jest.mock("glob", () => mockGlob);

// Mock gettext-parser
const mockGettextParser = {
  po: {
    compile: jest.fn(() => Buffer.from("# POT file content", "utf8")),
  },
};

jest.mock("../../plugins/loadGettextParser", () => ({
  loadGettextParser: jest.fn(() => Promise.resolve(mockGettextParser)),
}));

describe("generatePotFile", () => {
  const testSourceDir = "/test/src";
  const testOutputPath = "/test/output/messages.pot";

  beforeEach(() => {
    jest.clearAllMocks();
    i18nStore.clear();

    // Mock file system defaults
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(`
      export const messages = {
        greeting: () => "Hello, world!",
        farewell: () => "Goodbye!"
      };
    `);
    mockedFs.mkdirSync.mockReturnValue(undefined as any);
    mockedFs.writeFileSync.mockReturnValue(undefined);

    // Mock glob to return test files
    mockGlob.sync.mockReturnValue(["/test/src/messages.ts", "/test/src/components/Button.tsx"]);
  });

  it("should generate POT file successfully", async () => {
    await generatePotFile({
      source: testSourceDir,
      output: testOutputPath,
      include: ["**/*.ts", "**/*.tsx"],
      projectId: "test-app 1.0",
    });

    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(testOutputPath, expect.any(Buffer));
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
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

    await generatePotFile({
      source: testSourceDir,
      output: testOutputPath,
      include: ["**/*.ts"],
    });

    expect(consoleSpy).toHaveBeenCalledWith("⚠️  No source files found matching the criteria");
    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("should handle file processing errors gracefully", async () => {
    mockedFs.readFileSync.mockImplementation(() => {
      throw new Error("File read error");
    });
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    await generatePotFile({
      source: testSourceDir,
      output: testOutputPath,
      include: ["**/*.ts"],
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
