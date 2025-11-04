import { jest } from "@jest/globals";
import fs from "fs";
import path from "path";
import { convertPoToJson, convertMultiplePoToJson } from "../convert";

// Create a mock that behaves like real gettext-parser but parses our test content
const mockGettextParser = {
  po: {
    parse: jest.fn((buffer: Buffer) => {
      const content = buffer.toString();

      // Simple PO parser for our test content
      const catalog = {
        charset: "utf-8",
        headers: {
          "project-id-version": "test-app 1.0",
          "content-type": "text/plain; charset=UTF-8",
        },
        translations: {
          // Header entry
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

      // Parse msgctxt, msgid, msgstr sequences
      const entryRegex = /msgctxt "([^"]+)"\s+msgid "([^"]+)"\s+msgstr "([^"]*)"/g;
      let match;

      while ((match = entryRegex.exec(content)) !== null) {
        const [, msgctxt, msgid, msgstr] = match;

        if (msgctxt && msgid) {
          catalog.translations[msgctxt] = {
            [msgid]: {
              msgid,
              msgctxt,
              msgstr: [msgstr || ""],
              comments: {},
            },
          };
        }
      }

      return catalog;
    }),
    compile: jest.fn(),
  },
};

// Mock loadGettextParser to return our mock
jest.mock("../../loadGettextParser", () => ({
  loadGettextParser: jest.fn(() => Promise.resolve(mockGettextParser)),
}));

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

// Sample PO file content for testing
const samplePoContent = `# Translation file
msgid ""
msgstr ""
"Project-Id-Version: test-app 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: es\\n"
"PO-Revision-Date: 2025-11-04T14:07:58.618Z\\n"

#: src/components/welcome.ts:5
msgctxt "a1b2c3d4e5"
msgid "Welcome Back!"
msgstr "¡Bienvenido de vuelta!"

#: src/components/auth.ts:12
msgctxt "f6g7h8i9j0"
msgid "Sign In"
msgstr "Iniciar Sesión"

#: src/components/auth.ts:24
msgctxt "k1l2m3n4o5"
msgid "Forgot Password?"
msgstr "¿Olvidaste tu contraseña?"

#: src/components/validation.ts:8
msgctxt "p6q7r8s9t0"
msgid "Invalid email: {{email}}"
msgstr "Correo inválido: {{email}}"

#: src/components/untranslated.ts:3
msgctxt "x9y8z7w6v5"
msgid "Untranslated Text"
msgstr ""
`;

const samplePoContentSecond = `# Second translation file
msgid ""
msgstr ""
"Project-Id-Version: test-app 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: fr\\n"

#: src/components/welcome.ts:5
msgctxt "a1b2c3d4e5"
msgid "Welcome Back!"
msgstr "Bienvenue de retour!"

#: src/components/settings.ts:15
msgctxt "z1y2x3w4v5"
msgid "Settings"
msgstr "Paramètres"
`;

describe("convertPoToJson", () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock console methods
    console.log = mockConsole.log;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;

    // Setup fs mocks with default behavior
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(Buffer.from(samplePoContent));
    mockedFs.writeFileSync.mockImplementation(() => {});
    mockedFs.mkdirSync.mockImplementation(() => "");
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  it("should convert PO file to flat JSON structure", async () => {
    await convertPoToJson({
      input: "/test/input.po",
      output: "/test/output.json",
    });

    // Check file operations
    expect(mockedFs.existsSync).toHaveBeenCalledWith("/test/input.po");
    expect(mockedFs.readFileSync).toHaveBeenCalledWith("/test/input.po");
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith("/test/output.json", expect.any(String), "utf8");

    // Check the JSON content separately
    const writtenContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    expect(writtenContent).toContain('"a1b2c3d4e5": "¡Bienvenido de vuelta!"');
  });

  it("should wrap translations under topLevelKey when specified", async () => {
    await convertPoToJson({
      input: "/test/input.po",
      output: "/test/output.json",
      topLevelKey: "messages",
    });

    expect(mockedFs.writeFileSync).toHaveBeenCalledWith("/test/output.json", expect.any(String), "utf8");

    // Check the JSON content separately
    const writtenContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    expect(writtenContent).toContain('"messages": {');
  });

  it("should handle custom indentation", async () => {
    await convertPoToJson({
      input: "/test/input.po",
      output: "/test/output.json",
      indent: 4,
    });

    const writtenContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1];
    expect(writtenContent).toMatch(/{\n    "a1b2c3d4e5"/); // 4 spaces
  });

  it("should skip untranslated entries with warning", async () => {
    await convertPoToJson({
      input: "/test/input.po",
      output: "/test/output.json",
    });

    expect(mockConsole.warn).toHaveBeenCalledWith("⚠️  Skipping untranslated key: x9y8z7w6v5");

    const writtenContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1];
    expect(writtenContent).not.toMatch(/"x9y8z7w6v5"/);
  });

  it("should create output directory if it doesn't exist", async () => {
    mockedFs.existsSync.mockImplementation((filePath) => {
      if (filePath === "/test/nonexistent/output.json") return true; // input file exists
      if (filePath === "/test/nonexistent") return false; // output dir doesn't exist
      return false;
    });

    await convertPoToJson({
      input: "/test/nonexistent/output.json",
      output: "/test/nonexistent/output.json",
    });

    expect(mockedFs.mkdirSync).toHaveBeenCalledWith("/test/nonexistent", { recursive: true });
  });

  it("should throw error if input file doesn't exist", async () => {
    mockedFs.existsSync.mockReturnValue(false);

    await expect(
      convertPoToJson({
        input: "/test/nonexistent.po",
        output: "/test/output.json",
      })
    ).rejects.toThrow("Input file not found: /test/nonexistent.po");
  });

  it("should use hex hash keys as JSON keys", async () => {
    await convertPoToJson({
      input: "/test/input.po",
      output: "/test/output.json",
    });

    const writtenContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    const parsedJson = JSON.parse(writtenContent);

    // Should have hex hash keys as direct properties
    expect(parsedJson).toHaveProperty("a1b2c3d4e5", "¡Bienvenido de vuelta!");
    expect(parsedJson).toHaveProperty("f6g7h8i9j0", "Iniciar Sesión");
    expect(parsedJson).toHaveProperty("k1l2m3n4o5", "¿Olvidaste tu contraseña?");
    expect(parsedJson).toHaveProperty("p6q7r8s9t0", "Correo inválido: {{email}}");

    // Should not have untranslated entries
    expect(parsedJson).not.toHaveProperty("x9y8z7w6v5");
  });
});

describe("convertMultiplePoToJson", () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock console methods
    console.log = mockConsole.log;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;

    // Setup default fs mock behavior
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.writeFileSync.mockImplementation(() => {});
    mockedFs.mkdirSync.mockImplementation(() => "");
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  it("should convert multiple PO files to JSON", async () => {
    mockGlob.sync.mockReturnValue(["/test/es.po", "/test/fr.po"]);

    // Mock different file contents
    (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
      if (filePath === "/test/es.po") return Buffer.from(samplePoContent);
      if (filePath === "/test/fr.po") return Buffer.from(samplePoContentSecond);
      return Buffer.from("");
    });

    await convertMultiplePoToJson({
      pattern: "/test/*.po",
      outputDir: "/test/output/",
    });

    // Should process both files
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith("/test/output/es.json", expect.any(String), "utf8");
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith("/test/output/fr.json", expect.any(String), "utf8");

    // Check the JSON content separately
    const esContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    const frContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[1][1] as string;
    expect(esContent).toContain('"a1b2c3d4e5": "¡Bienvenido de vuelta!"');
    expect(frContent).toContain('"a1b2c3d4e5": "Bienvenue de retour!"');
  });

  it("should create output directory for batch conversion", async () => {
    mockGlob.sync.mockReturnValue(["/test/es.po"]);
    mockedFs.existsSync.mockImplementation((filePath) => {
      if (filePath === "/test/es.po") return true;
      if (filePath === "/test/output") return false; // output dir doesn't exist
      return false;
    });

    await convertMultiplePoToJson({
      pattern: "/test/*.po",
      outputDir: "/test/output/",
    });

    expect(mockedFs.mkdirSync).toHaveBeenCalledWith("/test/output/", { recursive: true });
  });

  it("should warn when no PO files found", async () => {
    mockGlob.sync.mockReturnValue([]);

    await convertMultiplePoToJson({
      pattern: "/test/*.po",
      outputDir: "/test/output/",
    });

    expect(mockConsole.warn).toHaveBeenCalledWith("⚠️  No .po files found matching the pattern");
  });

  it("should handle errors gracefully for individual files", async () => {
    mockGlob.sync.mockReturnValue(["/test/es.po", "/test/broken.po"]);

    (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
      if (filePath === "/test/es.po") return Buffer.from(samplePoContent);
      if (filePath === "/test/broken.po") throw new Error("File read error");
      return Buffer.from("");
    });

    await convertMultiplePoToJson({
      pattern: "/test/*.po",
      outputDir: "/test/output/",
    });

    // Should still process the good file
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith("/test/output/es.json", expect.any(String), "utf8");

    // Should log error for broken file
    expect(mockConsole.error).toHaveBeenCalledWith("❌ Error converting /test/broken.po:", expect.any(Error));
  });
});
