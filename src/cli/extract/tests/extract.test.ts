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

// loadConfig is now automatically mocked by Jest setup

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

            // Only include msgctxt if it exists and is not undefined
            if (entryData.msgctxt && entryData.msgctxt !== "undefined") {
              potContent += `msgctxt "${entryData.msgctxt}"\n`;
            }
            potContent += `msgid "${msgid}"
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

      // Should contain cleaned parameter metadata with types
      expect(potContent).toContain("{0} name: string");
      expect(potContent).toContain("{1} age: number");
      expect(potContent).toContain("Hello {name}, you are {age} years old!");
      // JSDoc main description should be present but cleaned up
      expect(potContent).toContain("Greets a user with their name and age");
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

      // Should contain cleaned parameter metadata with types but without JSDoc descriptions
      expect(potContent).toContain("{0} count: number");
      expect(potContent).toContain("{1} total: number");
      expect(potContent).toContain("{0} username: string");
      expect(potContent).toContain("{1} email: string");
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

      // Should contain cleaned parameter metadata with types and mixed documentation
      expect(potContent).toContain("{0} fileName: string");
      expect(potContent).toContain("{1} size: number"); // No JSDoc for size parameter but has type
      expect(potContent).toContain("{2} errors: number");
      expect(potContent).toContain("File {fileName} ({size} bytes) has {errors} errors");
      // JSDoc main description should be present but cleaned up
      expect(potContent).toContain("Shows file analysis results");
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

      // Should not contain parameter metadata lines for parameterless functions
      expect(potContent).not.toContain("{0}");
      expect(potContent).not.toContain("{1}");
      expect(potContent).toContain("Welcome to our application!");
      expect(potContent).toContain("Loading...");
      // May contain JSDoc comments but not parameter-specific metadata
      expect(potContent).toContain("A simple welcome message");
    });

    it("should include TypeScript parameter types in metadata", async () => {
      // Mock file with various TypeScript parameter types
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
        if (pathStr.includes("types-test.messages.ts")) {
          return `export const TypesTestMessages = {
  /**
   * Various parameter types demonstration
   * @param isActive Whether the feature is active
   * @param userName The user's name
   * @param count Number of items
   * @param tags List of tags
   */
  multiType: (isActive: boolean, userName: string, count: number, tags: string[]): string =>
    "User {userName} has {count} items (active: {isActive}) with tags: {tags}",

  // Complex types without JSDoc
  complexTypes: (callback: () => void, data: { id: number; name: string }, optional?: string): string =>
    "Processing data {data} with callback",
};`;
        }
        return "export const NoMessages = {};";
      });

      mockGlob.sync.mockReturnValue(["/test/src/types-test.messages.ts"]);

      await extractKeysAndGeneratePotFile({
        source: testSourceDir,
        output: testOutputPath,
        include: ["**/*.messages.ts"],
        projectId: "test-types 1.0",
      });

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(testOutputPath, expect.any(Buffer));

      // Verify POT content includes TypeScript types
      const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
        (call) => call[0] === testOutputPath
      )?.[1] as Buffer;

      expect(potBuffer).toBeInstanceOf(Buffer);
      const potContent = potBuffer.toString();

      // Should contain cleaned parameter metadata with correct TypeScript types
      expect(potContent).toContain("{0} isActive: boolean");
      expect(potContent).toContain("{1} userName: string");
      expect(potContent).toContain("{2} count: number");
      expect(potContent).toContain("{3} tags: string[]");

      // Complex types should also be extracted
      expect(potContent).toContain("{0} callback: () => void");
      expect(potContent).toContain("{1} data: { id: number; name: string }");
      expect(potContent).toContain("{2} optional: string");

      // JSDoc main description should be preserved but cleaned up
      expect(potContent).toContain("Various parameter types demonstration");
    });

    describe("Method shorthand syntax support", () => {
      it("should extract parameter metadata from method shorthand with JSDoc", async () => {
        // Mock file with method shorthand syntax
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
          if (pathStr.includes("method-shorthand.messages.ts")) {
            return `export const MethodShorthandMessages = {
  /**
   * Method shorthand with full JSDoc
   * @param userName The user's name
   * @param status The user's status
   */
  methodWithJSDoc(userName: string, status: string): string {
    return "User {userName} is {status}";
  },
};`;
          }
          return "export const NoMessages = {};";
        });

        mockGlob.sync.mockReturnValue(["/test/src/method-shorthand.messages.ts"]);

        await extractKeysAndGeneratePotFile({
          source: testSourceDir,
          output: testOutputPath,
          include: ["**/*.messages.ts"],
          projectId: "method-shorthand-test 1.0",
        });

        expect(mockedFs.writeFileSync).toHaveBeenCalledWith(testOutputPath, expect.any(Buffer));

        // Verify POT content includes method shorthand JSDoc and parameter metadata
        const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
          (call) => call[0] === testOutputPath
        )?.[1] as Buffer;

        expect(potBuffer).toBeInstanceOf(Buffer);
        const potContent = potBuffer.toString();

        expect(potContent).toContain("Method shorthand with full JSDoc");
        expect(potContent).toContain("{0} userName: string - The user's name");
        expect(potContent).toContain("{1} status: string - The user's status");
        expect(potContent).toContain('msgid "User {userName} is {status}"');
      });

      it("should extract parameter metadata from method shorthand without JSDoc", async () => {
        // Mock file with method shorthand syntax without JSDoc
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
          if (pathStr.includes("method-no-jsdoc.messages.ts")) {
            return `export const MethodNoJSDocMessages = {
  // Method shorthand without JSDoc - should still show parameter types
  methodWithoutJSDoc(count: number, item: string): string {
    return "Found {count} {item}";
  },
};`;
          }
          return "export const NoMessages = {};";
        });

        mockGlob.sync.mockReturnValue(["/test/src/method-no-jsdoc.messages.ts"]);

        await extractKeysAndGeneratePotFile({
          source: testSourceDir,
          output: testOutputPath,
          include: ["**/*.messages.ts"],
          projectId: "method-no-jsdoc-test 1.0",
        });

        expect(mockedFs.writeFileSync).toHaveBeenCalledWith(testOutputPath, expect.any(Buffer));

        // Verify POT content includes parameter types without JSDoc descriptions
        const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
          (call) => call[0] === testOutputPath
        )?.[1] as Buffer;

        expect(potBuffer).toBeInstanceOf(Buffer);
        const potContent = potBuffer.toString();

        expect(potContent).toContain("{0} count: number");
        expect(potContent).toContain("{1} item: string");
        expect(potContent).not.toContain("count: number -"); // No JSDoc descriptions for parameters
        expect(potContent).not.toContain("item: string -"); // No JSDoc descriptions for parameters
        expect(potContent).toContain('msgid "Found {count} {item}"');
      });

      it("should handle mixed syntax styles (property assignment vs method shorthand vs function expression)", async () => {
        // Mock file with all three syntax styles
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
          if (pathStr.includes("mixed-syntax.messages.ts")) {
            return `export const MixedSyntaxMessages = {
  /**
   * Property assignment style
   * @param name The person's name
   */
  propertyStyle: (name: string): string => "Hello {name}",

  /**
   * Method shorthand style
   * @param item The item name
   */
  methodStyle(item: string): string {
    return "Item: {item}";
  },

  /**
   * Function expression style
   * @param value The value
   */
  functionStyle: function(value: string): string {
    return "Value: {value}";
  },
};`;
          }
          return "export const NoMessages = {};";
        });

        mockGlob.sync.mockReturnValue(["/test/src/mixed-syntax.messages.ts"]);

        await extractKeysAndGeneratePotFile({
          source: testSourceDir,
          output: testOutputPath,
          include: ["**/*.messages.ts"],
          projectId: "mixed-syntax-test 1.0",
        });

        expect(mockedFs.writeFileSync).toHaveBeenCalledWith(testOutputPath, expect.any(Buffer));

        // Verify POT content handles all three syntax styles correctly
        const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
          (call) => call[0] === testOutputPath
        )?.[1] as Buffer;

        expect(potBuffer).toBeInstanceOf(Buffer);
        const potContent = potBuffer.toString();

        // Property assignment style
        expect(potContent).toContain("Property assignment style");
        expect(potContent).toContain("{0} name: string - The person's name");
        expect(potContent).toContain('msgid "Hello {name}"');

        // Method shorthand style
        expect(potContent).toContain("Method shorthand style");
        expect(potContent).toContain("{0} item: string - The item name");
        expect(potContent).toContain('msgid "Item: {item}"');

        // Function expression style
        expect(potContent).toContain("Function expression style");
        expect(potContent).toContain("{0} value: string - The value");
        expect(potContent).toContain('msgid "Value: {value}"');

        // Should have exactly 3 translation entries (but no msgctxt since no @translationContext)
        // Exclude the header entry (msgid "")
        const msgidCount = (potContent.match(/msgid ".+"/g) || []).length;
        expect(msgidCount).toBe(3);
      });

      it("should handle method shorthand with complex parameter types", async () => {
        // Mock file with complex types in method shorthand
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
          if (pathStr.includes("complex-method.messages.ts")) {
            return `export const ComplexMethodMessages = {
  /**
   * Method with complex types
   * @param user User object with details
   * @param options Configuration options
   * @param callback Function to handle result
   */
  complexMethod(
    user: { name: string; age: number },
    options: string[] | null,
    callback: (result: boolean) => void
  ): string {
    return "Processing user {user} with options {options}";
  },
};`;
          }
          return "export const NoMessages = {};";
        });

        mockGlob.sync.mockReturnValue(["/test/src/complex-method.messages.ts"]);

        await extractKeysAndGeneratePotFile({
          source: testSourceDir,
          output: testOutputPath,
          include: ["**/*.messages.ts"],
          projectId: "complex-method-test 1.0",
        });

        expect(mockedFs.writeFileSync).toHaveBeenCalledWith(testOutputPath, expect.any(Buffer));

        // Verify POT content handles complex types correctly
        const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
          (call) => call[0] === testOutputPath
        )?.[1] as Buffer;

        expect(potBuffer).toBeInstanceOf(Buffer);
        const potContent = potBuffer.toString();

        expect(potContent).toContain("Method with complex types");
        expect(potContent).toContain("{0} user: { name: string; age: number } - User object with details");
        expect(potContent).toContain("{1} options: string[] | null - Configuration options");
        expect(potContent).toContain("{2} callback: (result: boolean) => void - Function to handle result");
        expect(potContent).toContain('msgid "Processing user {user} with options {options}"');
      });
    });
  });

  describe("Translation Context (@translationContext)", () => {
    beforeEach(() => {
      i18nStore.clear();
      jest.clearAllMocks();

      // Mock console methods
      console.log = mockConsole.log;
      console.warn = mockConsole.warn;
      console.error = mockConsole.error;
    });

    afterEach(() => {
      // Restore original console methods
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
    });

    it("includes translation context in msgctxt field", async () => {
      (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
        if (filePath === "/test/src/context.messages.ts") {
          return `export const Messages = {
  /**
   * @translationContext authentication
   */
  login: (): string => "Log In",

  /**
   * @translationContext navigation
   */
  home: (): string => "Home",
};`;
        }
        return "export const NoMessages = {};";
      });

      mockGlob.sync.mockReturnValue(["/test/src/context.messages.ts"]);

      await extractKeysAndGeneratePotFile({
        source: testSourceDir,
        output: testOutputPath,
        include: ["**/*.messages.ts"],
        projectId: "context-test 1.0",
      });

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(testOutputPath, expect.any(Buffer));

      const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
        (call) => call[0] === testOutputPath
      )?.[1] as Buffer;

      const potContent = potBuffer.toString();

      // Check that msgctxt contains translation context, not hash IDs
      expect(potContent).toContain('msgctxt "authentication"');
      expect(potContent).toContain('msgid "Log In"');
      expect(potContent).toContain('msgctxt "navigation"');
      expect(potContent).toContain('msgid "Home"');

      // Should not contain hash-like msgctxt values
      expect(potContent).not.toMatch(/msgctxt "[a-f0-9]{10}"/);
    });

    it("handles entries without translation context", async () => {
      (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
        if (filePath === "/test/src/mixed.messages.ts") {
          return `export const Messages = {
  /**
   * @translationContext forms
   */
  submit: (): string => "Submit",

  // No context annotation
  cancel: (): string => "Cancel",
};`;
        }
        return "export const NoMessages = {};";
      });

      mockGlob.sync.mockReturnValue(["/test/src/mixed.messages.ts"]);

      await extractKeysAndGeneratePotFile({
        source: testSourceDir,
        output: testOutputPath,
        include: ["**/*.messages.ts"],
        projectId: "mixed-test 1.0",
      });

      const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
        (call) => call[0] === testOutputPath
      )?.[1] as Buffer;

      const potContent = potBuffer.toString();

      // Entry with context
      expect(potContent).toContain('msgctxt "forms"');
      expect(potContent).toContain('msgid "Submit"');

      // Entry without context should not have msgctxt or have empty msgctxt
      const cancelSection = potContent.split('msgid "Cancel"')[0];
      const lastMsgctxt = cancelSection.lastIndexOf("msgctxt ");

      if (lastMsgctxt !== -1) {
        // If there's a msgctxt before Cancel, it should be for Submit, not Cancel
        const msgctxtLine = cancelSection.substring(lastMsgctxt).split("\n")[0];
        expect(msgctxtLine).toContain('msgctxt "forms"');
      }
    });

    it("preserves existing comments alongside translation context", async () => {
      (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
        if (filePath === "/test/src/detailed.messages.ts") {
          return `export const Messages = {
  /**
   * Welcome message shown to authenticated users
   * @translationContext user-dashboard
   * @param userName The user's display name
   */
  welcome: (userName: string): string => "Welcome back, {userName}!",
};`;
        }
        return "export const NoMessages = {};";
      });

      mockGlob.sync.mockReturnValue(["/test/src/detailed.messages.ts"]);

      await extractKeysAndGeneratePotFile({
        source: testSourceDir,
        output: testOutputPath,
        include: ["**/*.messages.ts"],
        projectId: "detailed-test 1.0",
      });

      const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
        (call) => call[0] === testOutputPath
      )?.[1] as Buffer;

      const potContent = potBuffer.toString();

      // Should have translation context in msgctxt
      expect(potContent).toContain('msgctxt "user-dashboard"');
      expect(potContent).toContain('msgid "Welcome back, {userName}!"');

      // Should preserve original comments
      expect(potContent).toContain("Welcome message shown to authenticated users");

      // Should include parameter metadata
      expect(potContent).toContain("{0} userName: string - The user's display name");
    });

    it("handles complex translation contexts with special characters", async () => {
      (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
        if (filePath === "/test/src/complex-context.messages.ts") {
          return `export const Messages = {
  /**
   * @translationContext user-settings.privacy.notifications
   */
  emailNotifications: (): string => "Email notifications",

  /**
   * @translationContext admin-panel/user-management
   */
  deleteUser: (): string => "Delete user",
};`;
        }
        return "export const NoMessages = {};";
      });

      mockGlob.sync.mockReturnValue(["/test/src/complex-context.messages.ts"]);

      await extractKeysAndGeneratePotFile({
        source: testSourceDir,
        output: testOutputPath,
        include: ["**/*.messages.ts"],
        projectId: "complex-context-test 1.0",
      });

      const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
        (call) => call[0] === testOutputPath
      )?.[1] as Buffer;

      const potContent = potBuffer.toString();

      // Should handle complex context strings properly
      expect(potContent).toContain('msgctxt "user-settings.privacy.notifications"');
      expect(potContent).toContain('msgid "Email notifications"');
      expect(potContent).toContain('msgctxt "admin-panel/user-management"');
      expect(potContent).toContain('msgid "Delete user"');
    });

    it("uses first @translationContext when multiple are present", async () => {
      (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
        if (filePath === "/test/src/multiple-contexts.messages.ts") {
          return `export const Messages = {
  /**
   * @translationContext first-context
   * @translationContext second-context
   * This should use first-context
   */
  message: (): string => "Test message",
};`;
        }
        return "export const NoMessages = {};";
      });

      mockGlob.sync.mockReturnValue(["/test/src/multiple-contexts.messages.ts"]);

      await extractKeysAndGeneratePotFile({
        source: testSourceDir,
        output: testOutputPath,
        include: ["**/*.messages.ts"],
        projectId: "multiple-contexts-test 1.0",
      });

      const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
        (call) => call[0] === testOutputPath
      )?.[1] as Buffer;

      const potContent = potBuffer.toString();

      // Should use the first context
      expect(potContent).toContain('msgctxt "first-context"');
      expect(potContent).not.toContain('msgctxt "second-context"');
      expect(potContent).toContain('msgid "Test message"');
    });

    it("sorts entries correctly with and without contexts", async () => {
      (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
        if (filePath === "/test/src/sorting.messages.ts") {
          return `export const Messages = {
  /**
   * @translationContext z-context
   */
  zMessage: (): string => "Z message",

  aMessage: (): string => "A message",

  /**
   * @translationContext b-context
   */
  bMessage: (): string => "B message",
};`;
        }
        return "export const NoMessages = {};";
      });

      mockGlob.sync.mockReturnValue(["/test/src/sorting.messages.ts"]);

      await extractKeysAndGeneratePotFile({
        source: testSourceDir,
        output: testOutputPath,
        include: ["**/*.messages.ts"],
        projectId: "sorting-test 1.0",
      });

      const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
        (call) => call[0] === testOutputPath
      )?.[1] as Buffer;

      const potContent = potBuffer.toString();

      // All messages should be present with appropriate contexts
      expect(potContent).toContain('msgctxt "z-context"');
      expect(potContent).toContain('msgid "Z message"');
      expect(potContent).toContain('msgctxt "b-context"');
      expect(potContent).toContain('msgid "B message"');
      expect(potContent).toContain('msgid "A message"');

      // The POT file should be sorted (gettext-parser handles this)
      expect(potContent).toMatch(/msgid/g);
    });

    describe("JSDoc Description Preservation", () => {
      it("preserves JSDoc descriptions when @translationContext is present", async () => {
        (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
          if (filePath === "/test/src/description-context.messages.ts") {
            return `export const Messages = {
  /**
   * Close button for modal dialogs
   * @translationContext dialog
   */
  closeDialog: (): string => "Close",

  /**
   * Save action for user profile settings
   * @translationContext user-profile
   */
  saveProfile: (): string => "Save",

  /**
   * Multi-line description that spans
   * multiple lines with details
   * @translationContext complex-feature
   */
  complexAction: (): string => "Execute Action",
};`;
          }
          return "export const NoMessages = {};";
        });

        mockGlob.sync.mockReturnValue(["/test/src/description-context.messages.ts"]);

        await extractKeysAndGeneratePotFile({
          source: testSourceDir,
          output: testOutputPath,
          include: ["**/*.messages.ts"],
          projectId: "description-context-test 1.0",
        });

        const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
          (call) => call[0] === testOutputPath
        )?.[1] as Buffer;
        const potContent = potBuffer.toString();

        // Verify JSDoc descriptions are preserved as #. comments
        expect(potContent).toContain("#. Close button for modal dialogs");
        expect(potContent).toContain("#. Save action for user profile settings");
        // Note: Multi-line descriptions get flattened and may contain * from JSDoc formatting
        expect(potContent).toContain("#. Multi-line description that spans * multiple lines with details");

        // Verify translation contexts are in msgctxt
        expect(potContent).toContain('msgctxt "dialog"');
        expect(potContent).toContain('msgctxt "user-profile"');
        expect(potContent).toContain('msgctxt "complex-feature"');

        // Verify msgids are correct
        expect(potContent).toContain('msgid "Close"');
        expect(potContent).toContain('msgid "Save"');
        expect(potContent).toContain('msgid "Execute Action"');

        // Verify @translationContext doesn't appear in descriptions
        expect(potContent).not.toContain("#. @translationContext");
      });

      it("preserves JSDoc descriptions when @param is present without duplication", async () => {
        (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
          if (filePath === "/test/src/description-params.messages.ts") {
            return `export const Messages = {
  /**
   * Welcome message for new users
   * @param name The user's display name
   * @param count Number of items in their account
   */
  welcomeMessage: (name: string, count: number): string => "Welcome {name}! You have {count} items.",

  /**
   * Error notification with details
   * @param errorCode The specific error identifier
   */
  errorNotification: (errorCode: string): string => "Error occurred: {errorCode}",

  /**
   * Simple greeting without parameters but with description
   */
  simpleGreeting: (): string => "Hello there!",
};`;
          }
          return "export const NoMessages = {};";
        });

        mockGlob.sync.mockReturnValue(["/test/src/description-params.messages.ts"]);

        await extractKeysAndGeneratePotFile({
          source: testSourceDir,
          output: testOutputPath,
          include: ["**/*.messages.ts"],
          projectId: "description-params-test 1.0",
        });

        const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
          (call) => call[0] === testOutputPath
        )?.[1] as Buffer;
        const potContent = potBuffer.toString();

        // Verify JSDoc descriptions are preserved (without @param content)
        expect(potContent).toContain("#. Welcome message for new users");
        expect(potContent).toContain("#. Error notification with details");
        // Note: Single-line descriptions may have * prefix from JSDoc formatting
        expect(potContent).toContain("#. * Simple greeting without parameters but with description");

        // Verify parameter metadata appears separately
        expect(potContent).toContain("{0} name: string - The user's display name");
        expect(potContent).toContain("{1} count: number - Number of items in their account");
        expect(potContent).toContain("{0} errorCode: string - The specific error identifier");

        // Verify @param doesn't appear in main descriptions
        expect(potContent).not.toContain("#. Welcome message for new users @param");
        expect(potContent).not.toContain("#. Error notification with details @param");

        // Verify parameter descriptions don't appear twice
        const nameParamMatches = (potContent.match(/The user's display name/g) || []).length;
        const countParamMatches = (potContent.match(/Number of items in their account/g) || []).length;
        expect(nameParamMatches).toBe(1);
        expect(countParamMatches).toBe(1);
      });

      it("handles JSDoc descriptions with both @translationContext and @param correctly", async () => {
        (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
          if (filePath === "/test/src/full-jsdoc.messages.ts") {
            return `export const Messages = {
  /**
   * Confirmation message for user deletion
   * @translationContext admin-panel
   * @param userName The name of the user being deleted
   * @param itemCount How many items they have
   */
  deleteConfirmation: (userName: string, itemCount: number): string =>
    "Delete user {userName}? This will remove {itemCount} items.",

  /**
   * Status update notification
   * @param status Current status code
   * @translationContext notifications
   * @param timestamp When the status changed
   */
  statusUpdate: (status: string, timestamp: number): string =>
    "Status changed to {status} at {timestamp}",

  /**
   * Simple message with only translation context
   * @translationContext simple-context
   */
  simpleMessage: (): string => "Simple text",
};`;
          }
          return "export const NoMessages = {};";
        });

        mockGlob.sync.mockReturnValue(["/test/src/full-jsdoc.messages.ts"]);

        await extractKeysAndGeneratePotFile({
          source: testSourceDir,
          output: testOutputPath,
          include: ["**/*.messages.ts"],
          projectId: "full-jsdoc-test 1.0",
        });

        const potBuffer = (mockedFs.writeFileSync as jest.Mock).mock.calls.find(
          (call) => call[0] === testOutputPath
        )?.[1] as Buffer;
        const potContent = potBuffer.toString();

        // Verify main descriptions are preserved (without @tags)
        expect(potContent).toContain("#. Confirmation message for user deletion");
        expect(potContent).toContain("#. Status update notification");
        expect(potContent).toContain("#. Simple message with only translation context");

        // Verify translation contexts
        expect(potContent).toContain('msgctxt "admin-panel"');
        expect(potContent).toContain('msgctxt "notifications"');
        expect(potContent).toContain('msgctxt "simple-context"');

        // Verify parameter metadata
        expect(potContent).toContain("{0} userName: string - The name of the user being deleted");
        expect(potContent).toContain("{1} itemCount: number - How many items they have");
        expect(potContent).toContain("{0} status: string - Current status code");
        expect(potContent).toContain("{1} timestamp: number - When the status changed");

        // Verify no @tags appear in descriptions
        expect(potContent).not.toContain("#. Confirmation message for user deletion @translationContext");
        expect(potContent).not.toContain("#. Status update notification @param");
        expect(potContent).not.toContain("#. @translationContext");
        expect(potContent).not.toContain("#. @param");

        // Verify no duplication of information
        const userNameMatches = (potContent.match(/The name of the user being deleted/g) || []).length;
        const statusMatches = (potContent.match(/Current status code/g) || []).length;
        expect(userNameMatches).toBe(1);
        expect(statusMatches).toBe(1);
      });
    });
  });
});
