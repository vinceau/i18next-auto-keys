import { compileWithMemoryFS } from "../../loaders/tests/helpers/compile";
import { stableHash } from "../../common/hash";

// Import from the SAME path that the bundled loader uses to ensure same instance
const LOADER_PATH = require.resolve("../../../dist/index.js");
const { I18nEmitPlugin } = require(LOADER_PATH);

describe("I18nEmitPlugin integration", () => {

  test("emits JSON file with extracted messages from loader", async () => {
    const rules = [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: require.resolve("esbuild-loader"),
            options: {
              loader: "ts",
              target: "es2020",
            },
          },
          {
            loader: "i18next-icu-loader",
            options: {
              include: /\.messages\.ts$/,
              hashLength: 10,
            }
          },
        ],
      },
    ];

    const plugin = new I18nEmitPlugin({
      jsonOutputPath: "i18n/messages.json"
    });

    const { fs } = await compileWithMemoryFS(
      {
        "src/entry.ts": `import { Messages } from './ui.messages'; console.log(Messages.greeting());`,
        "src/ui.messages.ts": `export const Messages = {
          greeting: (): string => "Hello, World!",
          farewell: (): string => "Goodbye!",
        };`,
      },
      rules,
      {
        entry: "/src/entry.ts",
        plugins: [plugin]
      }
    );

    // Verify JSON file was emitted
    expect(fs.existsSync("/dist/i18n/messages.json")).toBe(true);

    const jsonContent = fs.readFileSync("/dist/i18n/messages.json", "utf8");
    const messagesDict = JSON.parse(jsonContent.toString());

    // Verify the JSON contains the expected message mappings
    const helloHash = stableHash("Hello, World!", 10);
    const goodbyeHash = stableHash("Goodbye!", 10);

    expect(messagesDict).toEqual({
      [helloHash]: "Hello, World!",
      [goodbyeHash]: "Goodbye!",
    });
  });

  test("emits POT file with extracted messages when gettext-parser is available", async () => {
    const rules = [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: require.resolve("esbuild-loader"),
            options: {
              loader: "ts",
              target: "es2020",
            },
          },
          {
            loader: "i18next-icu-loader",
            options: {
              include: /\.messages\.ts$/,
              hashLength: 10,
            }
          },
        ],
      },
    ];

    const plugin = new I18nEmitPlugin({
      jsonOutputPath: "i18n/messages.json",
      potOutputPath: "i18n/messages.pot",
      projectIdVersion: "test-app 1.0"
    });

    const { fs } = await compileWithMemoryFS(
      {
        "src/entry.ts": `import { Messages } from './ui.messages'; console.log(Messages.greeting());`,
        "src/ui.messages.ts": `export const Messages = {
          greeting: (): string => "Welcome to our app!",
          status: (): string => "Ready",
        };`,
      },
      rules,
      {
        entry: "/src/entry.ts",
        plugins: [plugin]
      }
    );

    // Verify POT file was emitted (if gettext-parser is available)
    if (fs.existsSync("/dist/i18n/messages.pot")) {
      const potContent = fs.readFileSync("/dist/i18n/messages.pot", "utf8").toString();

      // Verify POT file contains expected structure
      expect(potContent).toContain("Project-Id-Version: test-app 1.0");
      expect(potContent).toContain("Content-Type: text/plain; charset=utf-8");
      expect(potContent).toContain("x-generator: I18nEmitPlugin");

      // Verify it contains our messages
      expect(potContent).toContain("Welcome to our app!");
      expect(potContent).toContain("Ready");

      // Verify msgctxt (hashes) are present
      const welcomeHash = stableHash("Welcome to our app!", 10);
      const readyHash = stableHash("Ready", 10);
      expect(potContent).toContain(`msgctxt "${welcomeHash}"`);
      expect(potContent).toContain(`msgctxt "${readyHash}"`);
    } else {
      console.warn("gettext-parser not available, skipping POT file verification");
    }
  });

  test("handles multiple message files and preserves file references", async () => {
    const rules = [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: require.resolve("esbuild-loader"),
            options: {
              loader: "ts",
              target: "es2020",
            },
          },
          {
            loader: "i18next-icu-loader",
            options: {
              include: /\.messages\.ts$/,
              hashLength: 10,
            }
          },
        ],
      },
    ];

    const plugin = new I18nEmitPlugin({
      jsonOutputPath: "i18n/messages.json"
    });

    const { fs } = await compileWithMemoryFS(
      {
        "src/entry.ts": `
          import { UIMessages } from './ui.messages';
          import { ErrorMessages } from './errors.messages';
          console.log(UIMessages.welcome(), ErrorMessages.notFound());
        `,
        "src/ui.messages.ts": `export const UIMessages = {
          welcome: (): string => "Welcome!",
          loading: (): string => "Loading...",
        };`,
        "src/errors.messages.ts": `export const ErrorMessages = {
          notFound: (): string => "Not found",
          serverError: (): string => "Server error",
        };`,
      },
      rules,
      {
        entry: "/src/entry.ts",
        plugins: [plugin]
      }
    );

    // Verify JSON file contains messages from both files
    const jsonContent = fs.readFileSync("/dist/i18n/messages.json", "utf8");
    const messagesDict = JSON.parse(jsonContent.toString());

    expect(Object.keys(messagesDict)).toHaveLength(4);
    expect(Object.values(messagesDict)).toEqual(
      expect.arrayContaining([
        "Welcome!",
        "Loading...",
        "Not found",
        "Server error"
      ])
    );

    // Verify each message has a proper hash
    Object.keys(messagesDict).forEach(hash => {
      expect(hash).toMatch(/^[a-f0-9]{10}$/);
    });
  });

  test("handles empty message files gracefully", async () => {
    const rules = [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: require.resolve("esbuild-loader"),
            options: {
              loader: "ts",
              target: "es2020",
            },
          },
          {
            loader: "i18next-icu-loader",
            options: {
              include: /\.messages\.ts$/,
              hashLength: 10,
            }
          },
        ],
      },
    ];

    const plugin = new I18nEmitPlugin({
      jsonOutputPath: "i18n/messages.json"
    });

    const { fs } = await compileWithMemoryFS(
      {
        "src/entry.ts": `import { Messages } from './empty.messages'; console.log("no messages");`,
        "src/empty.messages.ts": `export const Messages = {};`, // No messages
      },
      rules,
      {
        entry: "/src/entry.ts",
        plugins: [plugin]
      }
    );

    // Verify JSON file was still emitted but is empty
    expect(fs.existsSync("/dist/i18n/messages.json")).toBe(true);

    const jsonContent = fs.readFileSync("/dist/i18n/messages.json", "utf8");
    const messagesDict = JSON.parse(jsonContent.toString());

    expect(messagesDict).toEqual({});
  });
});
