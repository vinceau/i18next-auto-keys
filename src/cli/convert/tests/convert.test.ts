import { jest } from "@jest/globals";
import fs from "fs";
import path from "path";
import { convertPoToJson, convertMultiplePoToJson } from "../convert";
import { stableHash } from "../../../common/hash";

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

      // Parse msgctxt, msgid, msgstr sequences (with and without msgctxt)
      const entryWithContextRegex = /msgctxt "([^"]+)"\s+msgid "([^"]+)"\s+msgstr "([^"]*)"/g;
      const entryWithoutContextRegex = /(?<!msgctxt "[^"]*"\s+)msgid "([^"]+)"\s+msgstr "([^"]*)"/g;

      let match;

      // Parse entries with context
      while ((match = entryWithContextRegex.exec(content)) !== null) {
        const [, msgctxt, msgid, msgstr] = match;

        if (msgctxt && msgid) {
          // Store entries with context under their msgctxt
          if (!catalog.translations[msgctxt]) {
            catalog.translations[msgctxt] = {};
          }
          catalog.translations[msgctxt][msgid] = {
            msgid,
            msgctxt,
            msgstr: [msgstr || ""],
            comments: {},
          };
        }
      }

      // Parse entries without context
      content.replace(entryWithContextRegex, ""); // Remove entries with context first
      const contentWithoutContext = content.replace(entryWithContextRegex, "");

      while ((match = entryWithoutContextRegex.exec(contentWithoutContext)) !== null) {
        const [, msgid, msgstr] = match;

        if (msgid && msgid !== "") {
          // Skip header
          if (!catalog.translations[""]) {
            catalog.translations[""] = {};
          }
          catalog.translations[""][msgid] = {
            msgid,
            msgctxt: undefined,
            msgstr: [msgstr || ""],
            comments: {},
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

// loadConfig is now automatically mocked by Jest setup

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

// Sample PO file content for testing (NEW FORMAT with translation context in msgctxt)
const samplePoContent = `# Translation file
msgid ""
msgstr ""
"Project-Id-Version: test-app 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: es\\n"
"PO-Revision-Date: 2025-11-04T14:07:58.618Z\\n"

#: src/components/welcome.ts:5
msgctxt "authentication"
msgid "Welcome Back!"
msgstr "¡Bienvenido de vuelta!"

#: src/components/auth.ts:12
msgctxt "authentication"
msgid "Sign In"
msgstr "Iniciar Sesión"

#: src/components/auth.ts:24
msgctxt "authentication"
msgid "Forgot Password?"
msgstr "¿Olvidaste tu contraseña?"

#: src/components/validation.ts:8
msgctxt "forms"
msgid "Invalid email: {{email}}"
msgstr "Correo inválido: {{email}}"

#: src/components/untranslated.ts:3
msgctxt "navigation"
msgid "Untranslated Text"
msgstr ""

#: src/components/simple.ts:1
msgid "Simple message without context"
msgstr "Mensaje simple sin contexto"
`;

const samplePoContentSecond = `# Second translation file
msgid ""
msgstr ""
"Project-Id-Version: test-app 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: fr\\n"

#: src/components/welcome.ts:5
msgctxt "user-dashboard"
msgid "Welcome Back!"
msgstr "Bienvenue de retour!"

#: src/components/settings.ts:15
msgctxt "settings-panel"
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

  it("should convert PO file to flat JSON structure with generated hashes", async () => {
    await convertPoToJson({
      input: "/test/input.po",
      output: "/test/output.json",
    });

    // Check file operations
    expect(mockedFs.existsSync).toHaveBeenCalledWith("/test/input.po");
    expect(mockedFs.readFileSync).toHaveBeenCalledWith("/test/input.po");
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith("/test/output.json", expect.any(String), "utf8");

    // Check the JSON content - hashes should be generated from msgid + msgctxt
    const writtenContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    const parsedJson = JSON.parse(writtenContent);

    // Calculate expected hashes
    const welcomeHash = stableHash("Welcome Back!", "authentication", 10);
    const signInHash = stableHash("Sign In", "authentication", 10);
    const forgotPasswordHash = stableHash("Forgot Password?", "authentication", 10);
    const validationHash = stableHash("Invalid email: {{email}}", "forms", 10);
    const simpleHash = stableHash("Simple message without context", undefined, 10);

    expect(parsedJson).toHaveProperty(welcomeHash, "¡Bienvenido de vuelta!");
    expect(parsedJson).toHaveProperty(signInHash, "Iniciar Sesión");
    expect(parsedJson).toHaveProperty(forgotPasswordHash, "¿Olvidaste tu contraseña?");
    expect(parsedJson).toHaveProperty(validationHash, "Correo inválido: {{email}}");
    expect(parsedJson).toHaveProperty(simpleHash, "Mensaje simple sin contexto");
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
    // Check that 4-space indentation is used
    expect(writtenContent).toMatch(/{\n    "/); // 4 spaces after opening brace
  });

  it("should skip untranslated entries with warning", async () => {
    await convertPoToJson({
      input: "/test/input.po",
      output: "/test/output.json",
    });

    expect(mockConsole.warn).toHaveBeenCalledWith("⚠️  Skipping untranslated key: navigation");

    const writtenContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1];
    const untranslatedHash = stableHash("Untranslated Text", "navigation", 10);
    expect(writtenContent).not.toContain(`"${untranslatedHash}"`);
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

  it("should generate hash keys based on msgid and msgctxt", async () => {
    await convertPoToJson({
      input: "/test/input.po",
      output: "/test/output.json",
    });

    const writtenContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    const parsedJson = JSON.parse(writtenContent);

    // Calculate expected hashes from msgid + msgctxt
    const welcomeHash = stableHash("Welcome Back!", "authentication", 10);
    const signInHash = stableHash("Sign In", "authentication", 10);
    const forgotPasswordHash = stableHash("Forgot Password?", "authentication", 10);
    const validationHash = stableHash("Invalid email: {{email}}", "forms", 10);
    const simpleHash = stableHash("Simple message without context", undefined, 10);

    // Should have generated hash keys as direct properties
    expect(parsedJson).toHaveProperty(welcomeHash, "¡Bienvenido de vuelta!");
    expect(parsedJson).toHaveProperty(signInHash, "Iniciar Sesión");
    expect(parsedJson).toHaveProperty(forgotPasswordHash, "¿Olvidaste tu contraseña?");
    expect(parsedJson).toHaveProperty(validationHash, "Correo inválido: {{email}}");
    expect(parsedJson).toHaveProperty(simpleHash, "Mensaje simple sin contexto");

    // Should not have untranslated entries
    const untranslatedHash = stableHash("Untranslated Text", "navigation", 10);
    expect(parsedJson).not.toHaveProperty(untranslatedHash);
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

    // Both should have the same hash for "Welcome Back!" but different contexts
    const esWelcomeHash = stableHash("Welcome Back!", "authentication", 10);
    const frWelcomeHash = stableHash("Welcome Back!", "user-dashboard", 10);

    expect(esContent).toContain(`"${esWelcomeHash}": "¡Bienvenido de vuelta!"`);
    expect(frContent).toContain(`"${frWelcomeHash}": "Bienvenue de retour!"`);
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

describe("Translation Context Hash Generation", () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock console methods
    console.log = mockConsole.log;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;

    // Setup fs mocks with default behavior
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

  it("should generate different hashes for same text with different contexts", async () => {
    const testPoContent = `msgid ""
msgstr ""
"Project-Id-Version: test-app 1.0\\n"

msgctxt "button"
msgid "Close"
msgstr "Cerrar"

msgctxt "dialog"
msgid "Close"
msgstr "Cerrar"

msgctxt "file-menu"
msgid "Close"
msgstr "Cerrar"
`;

    mockedFs.readFileSync.mockReturnValue(Buffer.from(testPoContent));

    await convertPoToJson({
      input: "/test/input.po",
      output: "/test/output.json",
    });

    const writtenContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    const parsedJson = JSON.parse(writtenContent);

    // Calculate expected hashes - same text, different contexts
    const buttonHash = stableHash("Close", "button", 10);
    const dialogHash = stableHash("Close", "dialog", 10);
    const fileMenuHash = stableHash("Close", "file-menu", 10);

    // All should be different hashes despite same English text
    expect(buttonHash).not.toBe(dialogHash);
    expect(buttonHash).not.toBe(fileMenuHash);
    expect(dialogHash).not.toBe(fileMenuHash);

    // All should be present in the JSON
    expect(parsedJson).toHaveProperty(buttonHash, "Cerrar");
    expect(parsedJson).toHaveProperty(dialogHash, "Cerrar");
    expect(parsedJson).toHaveProperty(fileMenuHash, "Cerrar");
  });

  it("should handle entries with and without context in the same file", async () => {
    const testPoContent = `msgid ""
msgstr ""
"Project-Id-Version: test-app 1.0\\n"

msgctxt "navigation"
msgid "Home"
msgstr "Inicio"

msgid "About"
msgstr "Acerca de"

msgctxt "user-menu"
msgid "Profile"
msgstr "Perfil"
`;

    mockedFs.readFileSync.mockReturnValue(Buffer.from(testPoContent));

    await convertPoToJson({
      input: "/test/input.po",
      output: "/test/output.json",
    });

    const writtenContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    const parsedJson = JSON.parse(writtenContent);

    // Calculate expected hashes
    const homeHash = stableHash("Home", "navigation", 10);
    const aboutHash = stableHash("About", undefined, 10); // No context
    const profileHash = stableHash("Profile", "user-menu", 10);

    expect(parsedJson).toHaveProperty(homeHash, "Inicio");
    expect(parsedJson).toHaveProperty(aboutHash, "Acerca de");
    expect(parsedJson).toHaveProperty(profileHash, "Perfil");
  });

  it("should handle complex translation contexts", async () => {
    const testPoContent = `msgid ""
msgstr ""
"Project-Id-Version: test-app 1.0\\n"

msgctxt "user-settings.privacy.notifications"
msgid "Email notifications"
msgstr "Notificaciones por email"

msgctxt "admin-panel/user-management"
msgid "Delete user"
msgstr "Eliminar usuario"

msgctxt "feature-flags.experimental.beta-features"
msgid "Enable beta features"
msgstr "Habilitar características beta"
`;

    mockedFs.readFileSync.mockReturnValue(Buffer.from(testPoContent));

    await convertPoToJson({
      input: "/test/input.po",
      output: "/test/output.json",
    });

    const writtenContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    const parsedJson = JSON.parse(writtenContent);

    // Calculate expected hashes with complex contexts
    const emailHash = stableHash("Email notifications", "user-settings.privacy.notifications", 10);
    const deleteHash = stableHash("Delete user", "admin-panel/user-management", 10);
    const betaHash = stableHash("Enable beta features", "feature-flags.experimental.beta-features", 10);

    expect(parsedJson).toHaveProperty(emailHash, "Notificaciones por email");
    expect(parsedJson).toHaveProperty(deleteHash, "Eliminar usuario");
    expect(parsedJson).toHaveProperty(betaHash, "Habilitar características beta");
  });

  it("should consistently generate the same hash for same source + context", async () => {
    const testPoContent = `msgid ""
msgstr ""
"Project-Id-Version: test-app 1.0\\n"

msgctxt "authentication"
msgid "Login"
msgstr "Iniciar sesión"
`;

    mockedFs.readFileSync.mockReturnValue(Buffer.from(testPoContent));

    // Convert multiple times
    await convertPoToJson({
      input: "/test/input1.po",
      output: "/test/output1.json",
    });

    await convertPoToJson({
      input: "/test/input2.po",
      output: "/test/output2.json",
    });

    const content1 = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    const content2 = (mockedFs.writeFileSync as jest.Mock).mock.calls[1][1] as string;

    // Should produce identical results
    expect(content1).toBe(content2);

    const json1 = JSON.parse(content1);
    const json2 = JSON.parse(content2);

    expect(json1).toEqual(json2);
  });

  it("should demonstrate context-based disambiguation in realistic scenario", async () => {
    // Real-world scenario: Same word in different contexts
    const testPoContent = `msgid ""
msgstr ""
"Project-Id-Version: test-app 1.0\\n"

msgctxt "file-menu"
msgid "Save"
msgstr "Guardar"

msgctxt "progress-indicator"
msgid "Save"
msgstr "Ahorro"

msgctxt "video-game"
msgid "Save"
msgstr "Guardado"

msgctxt "banking"
msgid "Save"
msgstr "Ahorrar"
`;

    mockedFs.readFileSync.mockReturnValue(Buffer.from(testPoContent));

    await convertPoToJson({
      input: "/test/input.po",
      output: "/test/output.json",
    });

    const writtenContent = (mockedFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    const parsedJson = JSON.parse(writtenContent);

    // Each context should get different hash despite same English word
    const fileMenuHash = stableHash("Save", "file-menu", 10);
    const progressHash = stableHash("Save", "progress-indicator", 10);
    const gameHash = stableHash("Save", "video-game", 10);
    const bankingHash = stableHash("Save", "banking", 10);

    // All hashes should be different
    const allHashes = [fileMenuHash, progressHash, gameHash, bankingHash];
    const uniqueHashes = new Set(allHashes);
    expect(uniqueHashes.size).toBe(4);

    // Each should have correct translation
    expect(parsedJson).toHaveProperty(fileMenuHash, "Guardar");
    expect(parsedJson).toHaveProperty(progressHash, "Ahorro");
    expect(parsedJson).toHaveProperty(gameHash, "Guardado");
    expect(parsedJson).toHaveProperty(bankingHash, "Ahorrar");
  });
});
