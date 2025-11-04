import { jest } from "@jest/globals";
import fs from "fs";
import { convertPoToJson, convertMultiplePoToJson } from "../convert";

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
const glob = require("glob");
const mockGlob = glob;

// Mock gettext-parser with realistic PO parsing
const mockGettextParser = {
  po: {
    parse: jest.fn((buffer: Buffer) => {
      const content = buffer.toString();

      // Parse a simple PO format for testing
      const catalog = {
        charset: "utf-8",
        headers: {
          "project-id-version": "test-app 1.0",
          "content-type": "text/plain; charset=UTF-8",
        },
        translations: {
          "": {} as any,
        },
      };

      // Add some test entries based on buffer content (using hex hash keys like the actual system)
      if (content.includes('msgctxt "a1b2c3d4e5"')) {
        catalog.translations[""]["Welcome Back!"] = {
          msgid: "Welcome Back!",
          msgctxt: "a1b2c3d4e5",
          msgstr: ["¡Bienvenido de vuelta!"],
          comments: {},
        };
      }

      if (content.includes('msgctxt "f6g7h8i9j0"')) {
        catalog.translations[""]["Sign In"] = {
          msgid: "Sign In",
          msgctxt: "f6g7h8i9j0",
          msgstr: ["Iniciar Sesión"],
          comments: {},
        };
      }

      if (content.includes('msgctxt "k1l2m3n4o5"')) {
        catalog.translations[""]["Forgot Password?"] = {
          msgid: "Forgot Password?",
          msgctxt: "k1l2m3n4o5",
          msgstr: ["¿Olvidaste tu contraseña?"],
          comments: {},
        };
      }

      if (content.includes('msgctxt "p6q7r8s9t0"')) {
        catalog.translations[""]["Invalid email: {{email}}"] = {
          msgid: "Invalid email: {{email}}",
          msgctxt: "p6q7r8s9t0",
          msgstr: ["Correo inválido: {{email}}"],
          comments: {},
        };
      }

      // Add an untranslated entry for testing
      if (content.includes('msgctxt "x9y8z7w6v5"')) {
        catalog.translations[""]["Untranslated Text"] = {
          msgid: "Untranslated Text",
          msgctxt: "x9y8z7w6v5",
          msgstr: [""],
          comments: {},
        };
      }

      return catalog;
    }),
  },
};

jest.mock("../../loadGettextParser", () => ({
  loadGettextParser: jest.fn(() => Promise.resolve(mockGettextParser)),
}));

describe("convertPoToJson", () => {
  const testInputPath = "/test/input/messages.po";
  const testOutputPath = "/test/output/messages.json";

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods to reduce test output noise
    console.log = mockConsole.log;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;

    // Mock file system defaults
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.mkdirSync.mockReturnValue(undefined as any);
    mockedFs.writeFileSync.mockReturnValue(undefined);
    mockedFs.readFileSync.mockReturnValue(
      Buffer.from(`
# Test PO file
msgid ""
msgstr ""
"Project-Id-Version: test-app 1.0\\n"

msgctxt "a1b2c3d4e5"
msgid "Welcome Back!"
msgstr "¡Bienvenido de vuelta!"

msgctxt "f6g7h8i9j0"
msgid "Sign In"
msgstr "Iniciar Sesión"

msgctxt "k1l2m3n4o5"
msgid "Forgot Password?"
msgstr "¿Olvidaste tu contraseña?"

msgctxt "p6q7r8s9t0"
msgid "Invalid email: {{email}}"
msgstr "Correo inválido: {{email}}"

msgctxt "x9y8z7w6v5"
msgid "Untranslated Text"
msgstr ""
     `)
    );

    // Reset the parser mock to default behavior
    (mockGettextParser.po.parse as jest.Mock).mockImplementation((buffer: any) => {
      const content = buffer.toString();

      // Parse a simple PO format for testing - match actual gettext-parser structure
      const catalog = {
        charset: "utf-8",
        headers: {
          "project-id-version": "test-app 1.0",
          "content-type": "text/plain; charset=UTF-8",
        },
        translations: {
          // Header entry (always present in gettext-parser output)
          "": {
            "": {
              msgid: "",
              msgstr: [
                "Project-Id-Version: test-app 1.0\\nmime-version: 1.0\\nContent-Type: text/plain; charset=utf-8\\nContent-Transfer-Encoding: 8bit\\nx-generator: i18next-auto-keys CLI\\nLanguage: \\nPO-Revision-Date: 2025-11-04T14:07:58.618Z\\n",
              ],
            },
          },
        } as any,
      };

      // Add some test entries based on buffer content (using hex hash keys like the actual system)
      // Structure matches actual gettext-parser: translations[msgctxt][msgid] = entryData
      if (content.includes('msgctxt "a1b2c3d4e5"')) {
        catalog.translations["a1b2c3d4e5"] = {
          "Welcome Back!": {
            msgid: "Welcome Back!",
            msgctxt: "a1b2c3d4e5",
            msgstr: ["¡Bienvenido de vuelta!"],
            comments: {},
          },
        };
      }

      if (content.includes('msgctxt "f6g7h8i9j0"')) {
        catalog.translations["f6g7h8i9j0"] = {
          "Sign In": {
            msgid: "Sign In",
            msgctxt: "f6g7h8i9j0",
            msgstr: ["Iniciar Sesión"],
            comments: {},
          },
        };
      }

      if (content.includes('msgctxt "k1l2m3n4o5"')) {
        catalog.translations["k1l2m3n4o5"] = {
          "Forgot Password?": {
            msgid: "Forgot Password?",
            msgctxt: "k1l2m3n4o5",
            msgstr: ["¿Olvidaste tu contraseña?"],
            comments: {},
          },
        };
      }

      if (content.includes('msgctxt "p6q7r8s9t0"')) {
        catalog.translations["p6q7r8s9t0"] = {
          "Invalid email: {{email}}": {
            msgid: "Invalid email: {{email}}",
            msgctxt: "p6q7r8s9t0",
            msgstr: ["Correo inválido: {{email}}"],
            comments: {},
          },
        };
      }

      // Add an untranslated entry for testing
      if (content.includes('msgctxt "x9y8z7w6v5"')) {
        catalog.translations["x9y8z7w6v5"] = {
          "Untranslated Text": {
            msgid: "Untranslated Text",
            msgctxt: "x9y8z7w6v5",
            msgstr: [""],
            comments: {},
          },
        };
      }

      return catalog;
    });
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  it("should convert PO file to flat JSON structure", async () => {
    await convertPoToJson({
      input: testInputPath,
      output: testOutputPath,
    });

    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
      testOutputPath,
      expect.stringContaining('"a1b2c3d4e5": "¡Bienvenido de vuelta!"'),
      "utf8"
    );

    // Get the written JSON content
    const writeCall = (mockedFs.writeFileSync as jest.Mock).mock.calls.find((call) => call[0] === testOutputPath);
    const jsonContent = writeCall?.[1] as string;
    const parsedJson = JSON.parse(jsonContent);

    expect(parsedJson).toEqual({
      a1b2c3d4e5: "¡Bienvenido de vuelta!",
      f6g7h8i9j0: "Iniciar Sesión",
      k1l2m3n4o5: "¿Olvidaste tu contraseña?",
      p6q7r8s9t0: "Correo inválido: {{email}}",
    });
  });

  it("should wrap translations under topLevelKey when specified", async () => {
    await convertPoToJson({
      input: testInputPath,
      output: testOutputPath,
      topLevelKey: "common",
    });

    const writeCall = (mockedFs.writeFileSync as jest.Mock).mock.calls.find((call) => call[0] === testOutputPath);
    const jsonContent = writeCall?.[1] as string;
    const parsedJson = JSON.parse(jsonContent);

    expect(parsedJson).toEqual({
      common: {
        a1b2c3d4e5: "¡Bienvenido de vuelta!",
        f6g7h8i9j0: "Iniciar Sesión",
        k1l2m3n4o5: "¿Olvidaste tu contraseña?",
        p6q7r8s9t0: "Correo inválido: {{email}}",
      },
    });
  });

  it("should handle custom indentation", async () => {
    await convertPoToJson({
      input: testInputPath,
      output: testOutputPath,
      indent: 4,
    });

    const writeCall = (mockedFs.writeFileSync as jest.Mock).mock.calls.find((call) => call[0] === testOutputPath);
    const jsonContent = writeCall?.[1] as string;

    // Check that it uses 4-space indentation
    expect(jsonContent).toMatch(/^{\n    "a1b2c3d4e5"/);
  });

  it("should skip untranslated entries with warning", async () => {
    await convertPoToJson({
      input: testInputPath,
      output: testOutputPath,
    });

    expect(mockConsole.warn).toHaveBeenCalledWith(expect.stringContaining("⚠️  Skipping untranslated key: x9y8z7w6v5"));
  });

  it("should create output directory if it doesn't exist", async () => {
    const outputDir = "/test/output";
    mockedFs.existsSync.mockImplementation((filePath) => {
      return filePath !== outputDir;
    });

    await convertPoToJson({
      input: testInputPath,
      output: testOutputPath,
    });

    expect(mockedFs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
  });

  it("should throw error if input file doesn't exist", async () => {
    mockedFs.existsSync.mockReturnValue(false);

    await expect(
      convertPoToJson({
        input: testInputPath,
        output: testOutputPath,
      })
    ).rejects.toThrow("Input file not found");
  });

  it("should use hex hash keys as JSON keys", async () => {
    // Test that hexadecimal hash keys are used as JSON keys (not nested objects)
    await convertPoToJson({
      input: testInputPath,
      output: testOutputPath,
    });

    const writeCall = (mockedFs.writeFileSync as jest.Mock).mock.calls.find((call) => call[0] === testOutputPath);
    const jsonContent = writeCall?.[1] as string;
    const parsedJson = JSON.parse(jsonContent);

    // Verify hexadecimal keys are used directly (flat structure matching README examples)
    expect(parsedJson["a1b2c3d4e5"]).toBe("¡Bienvenido de vuelta!");
    expect(parsedJson["f6g7h8i9j0"]).toBe("Iniciar Sesión");
    expect(parsedJson["k1l2m3n4o5"]).toBe("¿Olvidaste tu contraseña?");
    expect(parsedJson["p6q7r8s9t0"]).toBe("Correo inválido: {{email}}");
  });
});

describe("convertMultiplePoToJson", () => {
  const testPattern = "/test/locales/*.po";
  const testOutputDir = "/test/output";

  beforeEach(() => {
    jest.clearAllMocks();

    console.log = mockConsole.log;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;

    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.mkdirSync.mockReturnValue(undefined as any);
    mockedFs.writeFileSync.mockReturnValue(undefined);
    mockedFs.readFileSync.mockReturnValue(
      Buffer.from(`
msgctxt "a1b2c3d4e5"
msgid "Welcome Back!"
msgstr "¡Bienvenido de vuelta!"
    `)
    );

    // Mock glob to return multiple files
    mockGlob.sync.mockReturnValue(["/test/locales/es.po", "/test/locales/fr.po"]);
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  it("should convert multiple PO files to JSON", async () => {
    await convertMultiplePoToJson({
      pattern: testPattern,
      outputDir: testOutputDir,
    });

    // Should process both files
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith("/test/output/es.json", expect.any(String), "utf8");
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith("/test/output/fr.json", expect.any(String), "utf8");
  });

  it("should create output directory for batch conversion", async () => {
    mockedFs.existsSync.mockReturnValue(false);

    await convertMultiplePoToJson({
      pattern: testPattern,
      outputDir: testOutputDir,
    });

    expect(mockedFs.mkdirSync).toHaveBeenCalledWith(testOutputDir, { recursive: true });
  });

  it("should warn when no PO files found", async () => {
    mockGlob.sync.mockReturnValue([]);

    await convertMultiplePoToJson({
      pattern: testPattern,
      outputDir: testOutputDir,
    });

    expect(mockConsole.warn).toHaveBeenCalledWith("⚠️  No .po files found matching the pattern");
    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("should handle errors gracefully for individual files", async () => {
    // Make readFileSync throw for one file
    (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
      if (filePath.includes("es.po")) {
        throw new Error("File read error");
      }
      return Buffer.from(`
msgctxt "f6g7h8i9j0"
msgid "Sign In"
msgstr "Se connecter"
      `);
    });

    await convertMultiplePoToJson({
      pattern: testPattern,
      outputDir: testOutputDir,
    });

    expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining("❌ Error converting"), expect.any(Error));

    // Should still process the successful file
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith("/test/output/fr.json", expect.any(String), "utf8");
  });
});
