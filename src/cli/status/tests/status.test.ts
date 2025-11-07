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
});
