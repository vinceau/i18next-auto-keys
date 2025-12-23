import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";
import { promisify } from "util";

const execAsync = promisify(execSync);

/**
 * CLI E2E Tests for i18next-auto-keys
 *
 * These tests verify the CLI functionality by calling the compiled CLI.js file
 * with various command line arguments and verifying the output.
 */

describe("CLI E2E Tests", () => {
  const testDir = path.join(__dirname, "temp-cli-tests");
  const cliPath = path.resolve(__dirname, "../../dist/cli.js");

  // Test fixtures directory
  const fixturesDir = path.join(testDir, "fixtures");

  beforeAll(() => {
    // Ensure the CLI is built
    if (!fs.existsSync(cliPath)) {
      throw new Error(`CLI not built. Expected to find ${cliPath}. Run 'npm run build' first.`);
    }
  });

  beforeEach(() => {
    // Create test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(fixturesDir, { recursive: true });

    // Create basic test fixtures
    createTestFixtures();
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper function to execute CLI commands
   */
  async function runCliCommand(
    args: string[],
    options: { cwd?: string; expectError?: boolean } = {}
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    return new Promise((resolve, reject) => {
      const child = spawn("node", [cliPath, ...args], {
        cwd: options.cwd || testDir,
        stdio: "pipe",
        env: { ...process.env, NODE_ENV: "test" },
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      // Add timeout to prevent hanging tests
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error("Command timed out"));
      }, 30000);

      child.on("close", (code) => {
        clearTimeout(timeout); // Clear timeout when process completes
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
        });
      });

      child.on("error", (error) => {
        clearTimeout(timeout); // Clear timeout when process errors
        if (!options.expectError) {
          reject(error);
        } else {
          resolve({
            stdout,
            stderr: error.message,
            exitCode: 1,
          });
        }
      });
    });
  }

  /**
   * Create test fixtures for CLI tests
   */
  function createTestFixtures() {
    // Create sample TypeScript files with i18next-auto-keys usage (.messages.ts extension)
    const sampleMessagesFile = `
export const SampleMessages = {
  greetUser: (name: string): string => "Hello, {{name}}",
  showError: (): string => "An error occurred",
  showSuccess: (): string => "Operation completed successfully",
};
`;
    fs.writeFileSync(path.join(fixturesDir, "sample.messages.ts"), sampleMessagesFile);

    // Create another sample messages file
    const authMessagesFile = `
export const AuthMessages = {
  welcome: (): string => "Welcome back",
  logout: (): string => "Logout successful",
  profile: (): string => "Profile updated",
};
`;
    fs.writeFileSync(path.join(fixturesDir, "auth.messages.ts"), authMessagesFile);

    // Create a basic i18next-auto-keys config
    const config = {
      poOutputDirectory: path.join(testDir, "locales"),
      poTemplateName: "messages.pot",
      projectId: "test-project 1.0.0",
      jsonIndentSpaces: 2,
      topLevelKey: null,
    };
    fs.writeFileSync(path.join(testDir, "i18next-auto-keys.config.json"), JSON.stringify(config, null, 2));

    // Create locales directory
    fs.mkdirSync(path.join(testDir, "locales"), { recursive: true });

    // Create sample .pot file for sync tests
    const potContent = `
# Test POT file
#
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Project-Id-Version: test-project 1.0.0\\n"

msgid "Hello, {{name}}"
msgstr ""

msgid "An error occurred"
msgstr ""

msgid "Operation completed successfully"
msgstr ""

msgid "Welcome back"
msgstr ""

msgid "Logout successful"
msgstr ""

msgid "Profile updated"
msgstr ""
`;
    fs.writeFileSync(path.join(testDir, "locales", "messages.pot"), potContent.trim());

    // Create sample .po file for sync and convert tests
    const poContent = `
# French translations
#
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Project-Id-Version: test-project 1.0.0\\n"
"Language: fr\\n"

msgid "Hello, {{name}}"
msgstr "Bonjour, {{name}}"

msgid "An error occurred"
msgstr "Une erreur s'est produite"

msgid "Operation completed successfully"
msgstr ""

msgid "Welcome back"
msgstr "Bon retour"
`;
    fs.writeFileSync(path.join(testDir, "locales", "fr.po"), poContent.trim());
  }

  describe("extract command", () => {
    it("should extract translation keys and generate POT file", async () => {
      const result = await runCliCommand([
        "extract",
        "--include",
        "**/*.messages.ts",
        "--source",
        fixturesDir,
        "--output",
        path.join(testDir, "extracted.pot"),
      ]);

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(path.join(testDir, "extracted.pot"))).toBe(true);

      const potContent = fs.readFileSync(path.join(testDir, "extracted.pot"), "utf-8");
      expect(potContent).toContain("Hello, {{name}}");
      expect(potContent).toContain("An error occurred");
      expect(potContent).toContain("Welcome back");
    });

    it("should use config defaults when no output specified", async () => {
      const result = await runCliCommand(["extract", "--include", "**/*.messages.ts", "--source", fixturesDir]);

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(path.join(testDir, "locales", "messages.pot"))).toBe(true);
    });

    it("should respect exclude patterns", async () => {
      // Create a file in node_modules that should be excluded
      fs.mkdirSync(path.join(fixturesDir, "node_modules"), { recursive: true });
      fs.writeFileSync(
        path.join(fixturesDir, "node_modules", "test.messages.ts"),
        `
export const ExcludedMessages = {
  shouldNotBeIncluded: (): string => "This should be excluded",
};
      `
      );

      const result = await runCliCommand([
        "extract",
        "--include",
        "**/*.messages.ts",
        "--source",
        fixturesDir,
        "--output",
        path.join(testDir, "filtered.pot"),
      ]);

      expect(result.exitCode).toBe(0);

      const potContent = fs.readFileSync(path.join(testDir, "filtered.pot"), "utf-8");
      expect(potContent).not.toContain("This should be excluded");
    });

    it("should fail with missing required options", async () => {
      const result = await runCliCommand(["extract"], { expectError: true });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("required option");
    });
  });

  describe("sync command", () => {
    it("should sync PO files with template", async () => {
      const result = await runCliCommand([
        "sync",
        "--template",
        path.join(testDir, "locales", "messages.pot"),
        "--po-files",
        path.join(testDir, "locales", "*.po"),
      ]);

      expect(result.exitCode).toBe(0);

      // Check that the French PO file was updated
      const frPoContent = fs.readFileSync(path.join(testDir, "locales", "fr.po"), "utf-8");
      expect(frPoContent).toContain("Operation completed successfully");
      expect(frPoContent).toContain("Profile updated");
    });

    it("should create backup files when requested", async () => {
      const result = await runCliCommand([
        "sync",
        "--template",
        path.join(testDir, "locales", "messages.pot"),
        "--po-files",
        path.join(testDir, "locales", "*.po"),
        "--backup",
      ]);

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(path.join(testDir, "locales", "fr.po.backup"))).toBe(true);
    });

    it("should use config defaults when no options specified", async () => {
      // First extract keys to ensure we have a proper .pot file
      const extractResult = await runCliCommand(["extract", "--include", "**/*.messages.ts", "--source", fixturesDir]);
      expect(extractResult.exitCode).toBe(0);

      const result = await runCliCommand(["sync"]);

      expect(result.exitCode).toBe(0);
    });
  });

  describe("convert command", () => {
    it("should convert single PO file to JSON", async () => {
      const result = await runCliCommand([
        "convert",
        "--input",
        path.join(testDir, "locales", "fr.po"),
        "--output",
        path.join(testDir, "fr.json"),
      ]);

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(path.join(testDir, "fr.json"))).toBe(true);

      const jsonContent = JSON.parse(fs.readFileSync(path.join(testDir, "fr.json"), "utf-8"));

      // The CLI generates flat JSON with hash keys, not nested objects
      // Keys should be hashes of the msgid (source text) with default hash length of 10
      expect(Object.keys(jsonContent).length).toBeGreaterThan(0);

      // Check that we have expected translations (values should be the French translations)
      const values = Object.values(jsonContent);
      expect(values).toContain("Bonjour, {{name}}");
      expect(values).toContain("Une erreur s'est produite");
      expect(values).toContain("Bon retour");
    });

    it("should convert multiple PO files in batch mode", async () => {
      // Create another PO file
      const dePoContent = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: de\\n"

msgid "greeting.hello"
msgstr "Hallo, {{name}}"

msgid "error.generic"
msgstr "Ein Fehler ist aufgetreten"
`;
      fs.writeFileSync(path.join(testDir, "locales", "de.po"), dePoContent.trim());

      const outputDir = path.join(testDir, "json-output");
      fs.mkdirSync(outputDir, { recursive: true });

      const result = await runCliCommand([
        "convert",
        "--input",
        path.join(testDir, "locales", "*.po"),
        "--output",
        outputDir,
        "--batch",
      ]);

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(path.join(outputDir, "fr.json"))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, "de.json"))).toBe(true);
    });

    it("should support custom indentation", async () => {
      const result = await runCliCommand([
        "convert",
        "--input",
        path.join(testDir, "locales", "fr.po"),
        "--output",
        path.join(testDir, "fr-indented.json"),
        "--indent",
        "4",
      ]);

      expect(result.exitCode).toBe(0);

      const jsonContent = fs.readFileSync(path.join(testDir, "fr-indented.json"), "utf-8");
      // Check for 4-space indentation (the keys are hashes, not nested objects)
      expect(jsonContent).toMatch(/\n    "/); // 4 spaces before hash keys
      expect(jsonContent).not.toMatch(/\n  "/); // Should not have 2 spaces
    });

    it("should support top-level key wrapping", async () => {
      const result = await runCliCommand([
        "convert",
        "--input",
        path.join(testDir, "locales", "fr.po"),
        "--output",
        path.join(testDir, "fr-wrapped.json"),
        "--top-level-key",
        "translations",
      ]);

      expect(result.exitCode).toBe(0);

      const jsonContent = JSON.parse(fs.readFileSync(path.join(testDir, "fr-wrapped.json"), "utf-8"));
      expect(jsonContent.translations).toBeDefined();
      expect(typeof jsonContent.translations).toBe("object");

      // Check that the translations are wrapped under the top-level key
      const translationValues = Object.values(jsonContent.translations);
      expect(translationValues).toContain("Bonjour, {{name}}");
      expect(translationValues).toContain("Une erreur s'est produite");
    });

    it("should fail without required output option", async () => {
      const result = await runCliCommand(["convert"], { expectError: true });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("required option");
    });
  });

  describe("status command", () => {
    it("should show translation status for directory", async () => {
      const result = await runCliCommand(["status", "--directory", path.join(testDir, "locales")]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("fr"); // Language code in status display
      expect(result.stdout).toMatch(/\d+%/); // Should show percentage
    });

    it("should show verbose information when requested", async () => {
      const result = await runCliCommand(["status", "--directory", path.join(testDir, "locales"), "--verbose"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("fr.po");
      // Verbose mode should show more detailed information
      expect(result.stdout.length).toBeGreaterThan(100);
    });

    it("should fail when default directory doesn't exist", async () => {
      const result = await runCliCommand(["status"], { expectError: true });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Directory not found");
    });

    it("should handle non-existent directory gracefully", async () => {
      const result = await runCliCommand(["status", "--directory", path.join(testDir, "non-existent")], {
        expectError: true,
      });

      expect(result.exitCode).not.toBe(0);
    });
  });

  describe("general CLI behavior", () => {
    it("should show help when no command is provided", async () => {
      const result = await runCliCommand(["--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("i18next-auto-keys");
      expect(result.stdout).toContain("extract");
      expect(result.stdout).toContain("sync");
      expect(result.stdout).toContain("convert");
      expect(result.stdout).toContain("status");
    });

    it("should show version information", async () => {
      const result = await runCliCommand(["--version"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it("should show command-specific help", async () => {
      const result = await runCliCommand(["extract", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Extract translation keys");
      expect(result.stdout).toContain("--include");
      expect(result.stdout).toContain("--source");
      expect(result.stdout).toContain("--output");
    });

    it("should handle invalid commands gracefully", async () => {
      const result = await runCliCommand(["invalid-command"], { expectError: true });

      expect(result.exitCode).not.toBe(0);
    });
  });
});
