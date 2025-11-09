import fs from "fs";
import path from "path";
import { tmpdir } from "os";
import { showTranslationStatus } from "../status";

// loadGettextParser is automatically mocked by Jest setup - no need for custom mock here

describe("status command", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(tmpdir(), "i18n-status-test-"));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should handle directory with no .po files", async () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

    await showTranslationStatus({ directory: tempDir });

    expect(consoleSpy).toHaveBeenCalledWith("⚠️  No .po files found in the specified directory");
    consoleSpy.mockRestore();
  });

  it("should throw error for non-existent directory", async () => {
    const nonExistentDir = path.join(tempDir, "does-not-exist");

    await expect(showTranslationStatus({ directory: nonExistentDir })).rejects.toThrow(
      `Directory not found: ${nonExistentDir}`
    );
  });

  it("should analyze .po file and calculate progress correctly", async () => {
    // Create a sample .po file with mixed translation status
    const samplePoContent = `# Translation file for French
msgid ""
msgstr ""
"Language: fr\\n"
"Content-Type: text/plain; charset=UTF-8\\n"

#: src/component.ts:10
msgid "Hello"
msgstr "Bonjour"

#: src/component.ts:20
msgid "World"
msgstr ""

#: src/component.ts:30
msgid "Goodbye"
msgstr "Au revoir"

#: src/component.ts:40
msgctxt "greeting"
msgid "Welcome"
msgstr ""
`;

    const poFilePath = path.join(tempDir, "fr.po");
    fs.writeFileSync(poFilePath, samplePoContent);

    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    await showTranslationStatus({ directory: tempDir });

    // Verify that console.log was called (indicating the command ran)
    expect(consoleLogSpy).toHaveBeenCalled();

    // Check that the output contains expected information
    const logCalls = consoleLogSpy.mock.calls.map((call) => call.join(" "));
    const hasProgressOutput = logCalls.some((call) => call.includes("fr"));
    expect(hasProgressOutput).toBe(true);

    consoleLogSpy.mockRestore();
  });

  it("should handle verbose mode", async () => {
    // Create a simple .po file
    const samplePoContent = `msgid ""
msgstr ""
"Language: en\\n"

msgid "Test"
msgstr "Test translated"
`;

    const poFilePath = path.join(tempDir, "en.po");
    fs.writeFileSync(poFilePath, samplePoContent);

    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    await showTranslationStatus({ directory: tempDir, verbose: true });

    expect(consoleLogSpy).toHaveBeenCalled();

    // In verbose mode, should show file information
    const logCalls = consoleLogSpy.mock.calls.map((call) => call.join(" "));
    const hasFileInfo = logCalls.some((call) => call.includes("File:"));
    expect(hasFileInfo).toBe(true);

    consoleLogSpy.mockRestore();
  });

  it("should output only percentage in percent-only mode", async () => {
    // Create a sample .po file with 50% translation progress
    const samplePoContent = `# Translation file for French
msgid ""
msgstr ""
"Language: fr\\n"
"Content-Type: text/plain; charset=UTF-8\\n"

#: src/component.ts:10
msgid "Hello"
msgstr "Bonjour"

#: src/component.ts:20
msgid "World"
msgstr ""
`;

    const poFilePath = path.join(tempDir, "fr.po");
    fs.writeFileSync(poFilePath, samplePoContent);

    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    await showTranslationStatus({ directory: tempDir, percentOnly: true });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(50); // 1 out of 2 strings translated = 50%

    consoleLogSpy.mockRestore();
  });

  it("should output 0 in percent-only mode when no translations exist", async () => {
    // Create a sample .po file with no translations
    const samplePoContent = `# Translation file for Spanish
msgid ""
msgstr ""
"Language: es\\n"
"Content-Type: text/plain; charset=UTF-8\\n"

#: src/component.ts:10
msgid "Hello"
msgstr ""

#: src/component.ts:20
msgid "World"
msgstr ""
`;

    const poFilePath = path.join(tempDir, "es.po");
    fs.writeFileSync(poFilePath, samplePoContent);

    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    await showTranslationStatus({ directory: tempDir, percentOnly: true });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(0); // 0 out of 2 strings translated = 0%

    consoleLogSpy.mockRestore();
  });

  it("should output 100 in percent-only mode when all translations exist", async () => {
    // Create a sample .po file with 100% translation progress
    const samplePoContent = `# Translation file for German
msgid ""
msgstr ""
"Language: de\\n"
"Content-Type: text/plain; charset=UTF-8\\n"

#: src/component.ts:10
msgid "Hello"
msgstr "Hallo"

#: src/component.ts:20
msgid "World"
msgstr "Welt"
`;

    const poFilePath = path.join(tempDir, "de.po");
    fs.writeFileSync(poFilePath, samplePoContent);

    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    await showTranslationStatus({ directory: tempDir, percentOnly: true });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(100); // 2 out of 2 strings translated = 100%

    consoleLogSpy.mockRestore();
  });

  it("should calculate overall percentage across multiple files in percent-only mode", async () => {
    // Create first .po file with 100% progress (2/2)
    const frPoContent = `msgid ""
msgstr ""
"Language: fr\\n"

msgid "Hello"
msgstr "Bonjour"

msgid "World"
msgstr "Monde"
`;

    // Create second .po file with 0% progress (0/2)
    const esPoContent = `msgid ""
msgstr ""
"Language: es\\n"

msgid "Hello"
msgstr ""

msgid "World"
msgstr ""
`;

    fs.writeFileSync(path.join(tempDir, "fr.po"), frPoContent);
    fs.writeFileSync(path.join(tempDir, "es.po"), esPoContent);

    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    await showTranslationStatus({ directory: tempDir, percentOnly: true });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(50); // 2 out of 4 total strings translated = 50%

    consoleLogSpy.mockRestore();
  });

  it("should not output warning messages in percent-only mode when no po files found", async () => {
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

    await showTranslationStatus({ directory: tempDir, percentOnly: true });

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
});
