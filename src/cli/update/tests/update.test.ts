import { jest } from "@jest/globals";
import fs from "fs";
import { updatePoFiles } from "../update";

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

// Mock gettext-parser with realistic PO parsing and compilation
const mockGettextParser = {
  po: {
    parse: jest.fn((buffer: Buffer) => {
      const content = buffer.toString();

      // Mock POT template
      if (content.includes('msgid "Welcome Back!"')) {
        return {
          charset: "utf-8",
          headers: {
            "project-id-version": "test-app 1.0",
            "content-type": "text/plain; charset=UTF-8",
          },
          translations: {
            "": {
              "Welcome Back!": {
                msgid: "Welcome Back!",
                msgctxt: "a1b2c3d4e5",
                msgstr: [""],
                comments: {},
              },
              "Sign In": {
                msgid: "Sign In",
                msgctxt: "f6g7h8i9j0",
                msgstr: [""],
                comments: {},
              },
            },
          },
        };
      }

      // Mock existing .po file
      return {
        charset: "utf-8",
        headers: {
          "project-id-version": "test-app 1.0",
          "content-type": "text/plain; charset=UTF-8",
          language: "es",
          "po-revision-date": "2023-01-01T00:00:00.000Z",
        },
        translations: {
          "": {
            "Welcome Back!": {
              msgid: "Welcome Back!",
              msgctxt: "a1b2c3d4e5",
              msgstr: ["¡Bienvenido de vuelta!"],
              comments: {},
            },
            "Old String": {
              msgid: "Old String",
              msgctxt: "old123",
              msgstr: ["Cadena Antigua"],
              comments: {},
            },
          },
        },
      };
    }),
    compile: jest.fn(() => Buffer.from("compiled po content")),
  },
};

jest.mock("../../loadGettextParser", () => ({
  loadGettextParser: jest.fn(() => Promise.resolve(mockGettextParser)),
}));

describe("updatePoFiles", () => {
  const testTemplate = "/test/messages.pot";
  const testPoFiles = ["/test/locales/*.po"];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods to reduce test output noise
    console.log = mockConsole.log;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;

    // Mock file system defaults
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.copyFileSync.mockReturnValue(undefined);
    mockedFs.writeFileSync.mockReturnValue(undefined);
    mockedFs.readFileSync.mockReturnValue(Buffer.from("mock file content"));

    // Mock glob to return test files
    mockGlob.sync.mockReturnValue(["/test/locales/es.po", "/test/locales/fr.po"]);
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  it("should update .po files from template", async () => {
    await updatePoFiles({
      template: testTemplate,
      poFiles: testPoFiles,
    });

    expect(mockGlob.sync).toHaveBeenCalledWith("/test/locales/*.po", { absolute: true });
    expect(mockedFs.readFileSync).toHaveBeenCalledWith(testTemplate);
    expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(2); // es.po and fr.po
  });

  it("should create backup files when requested", async () => {
    await updatePoFiles({
      template: testTemplate,
      poFiles: testPoFiles,
      backup: true,
    });

    expect(mockedFs.copyFileSync).toHaveBeenCalledWith("/test/locales/es.po", "/test/locales/es.po.backup");
    expect(mockedFs.copyFileSync).toHaveBeenCalledWith("/test/locales/fr.po", "/test/locales/fr.po.backup");
  });

  it("should throw error if template doesn't exist", async () => {
    mockedFs.existsSync.mockReturnValue(false);

    await expect(
      updatePoFiles({
        template: testTemplate,
        poFiles: testPoFiles,
      })
    ).rejects.toThrow("Template file not found");
  });

  it("should warn when no .po files found", async () => {
    mockGlob.sync.mockReturnValue([]);

    await updatePoFiles({
      template: testTemplate,
      poFiles: testPoFiles,
    });

    expect(mockConsole.warn).toHaveBeenCalledWith("⚠️  No .po files found matching the patterns");
    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("should handle errors gracefully for individual files", async () => {
    // Make readFileSync throw for one file
    (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
      if (filePath.includes("es.po")) {
        throw new Error("File read error");
      }
      return Buffer.from("mock content");
    });

    await updatePoFiles({
      template: testTemplate,
      poFiles: testPoFiles,
    });

    expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining("❌ Error updating"), expect.any(Error));
  });

  it("should preserve existing translations and add new ones", async () => {
    await updatePoFiles({
      template: testTemplate,
      poFiles: testPoFiles,
    });

    // Verify that po.compile was called (indicating merge completed)
    expect(mockGettextParser.po.compile).toHaveBeenCalled();

    // Verify that writeFileSync was called for each .po file
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith("/test/locales/es.po", expect.any(Buffer));
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith("/test/locales/fr.po", expect.any(Buffer));
  });

  it("should remove duplicate po files", async () => {
    // Mock glob to return duplicates
    mockGlob.sync.mockReturnValue([
      "/test/locales/es.po",
      "/test/locales/es.po", // duplicate
      "/test/locales/fr.po",
    ]);

    await updatePoFiles({
      template: testTemplate,
      poFiles: testPoFiles,
    });

    // Should only update each file once despite duplicates
    expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(2);
  });

  it("should remove obsolete translations not in the new template", async () => {
    // Store the original mock implementation
    const originalParseImpl = mockGettextParser.po.parse;
    const originalReadFileImpl = mockedFs.readFileSync;

    try {
      // Mock readFileSync to return different content for template vs existing po
      (mockedFs.readFileSync as jest.Mock).mockImplementation((filePath: any) => {
        if (filePath.includes("messages.pot")) {
          return Buffer.from("template content");
        } else {
          return Buffer.from("existing po content");
        }
      });

      // Update the parser mock to handle this specific scenario
      (mockGettextParser.po.parse as jest.Mock).mockImplementation((buffer: any) => {
        const content = buffer.toString();

        if (content.includes("template")) {
          // Template only has "Welcome Back!" - no "Old String"
          return {
            charset: "utf-8",
            headers: {
              "project-id-version": "test-app 1.0",
            },
            translations: {
              "": {
                "Welcome Back!": {
                  msgid: "Welcome Back!",
                  msgctxt: "a1b2c3d4e5",
                  msgstr: [""],
                  comments: {},
                },
              },
            },
          };
        } else {
          // Existing .po file has both entries
          return {
            charset: "utf-8",
            headers: {
              "project-id-version": "test-app 1.0",
              language: "es",
            },
            translations: {
              "": {
                "Welcome Back!": {
                  msgid: "Welcome Back!",
                  msgctxt: "a1b2c3d4e5",
                  msgstr: ["¡Bienvenido de vuelta!"],
                  comments: {},
                },
                "Old String": {
                  msgid: "Old String",
                  msgctxt: "old123",
                  msgstr: ["Cadena Antigua"],
                  comments: {},
                },
              },
            },
          };
        }
      });

      await updatePoFiles({
        template: testTemplate,
        poFiles: testPoFiles,
      });

      // Should log removal of obsolete entry
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining("🗑️  Removing obsolete translation: old123")
      );

      // Should still write the updated file (but without obsolete entries)
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith("/test/locales/es.po", expect.any(Buffer));
    } finally {
      // Restore original implementations
      mockGettextParser.po.parse = originalParseImpl;
      mockedFs.readFileSync = originalReadFileImpl;
    }
  });
});
