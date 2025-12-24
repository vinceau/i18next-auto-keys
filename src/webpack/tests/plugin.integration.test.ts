import { compileWithMemoryFS } from "./helpers/compile";
import { stableHash } from "../../common/hash";

// Import from the SAME path that the bundled loader uses to ensure same instance
const LOADER_PATH = require.resolve("../../../dist/index.cjs");
const { I18nextAutoKeyEmitPlugin } = require(LOADER_PATH);

describe("I18nextAutoKeyEmitPlugin integration", () => {
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
            loader: "i18next-auto-keys",
            options: {
              include: /\.messages\.ts$/,
            },
          },
        ],
      },
    ];

    const plugin = new I18nextAutoKeyEmitPlugin({
      jsonOutputPath: "i18n/messages.json",
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
        plugins: [plugin],
      }
    );

    // Verify JSON file was emitted
    expect(fs.existsSync("/dist/i18n/messages.json")).toBe(true);

    const jsonContent = fs.readFileSync("/dist/i18n/messages.json", "utf8");
    const messagesDict = JSON.parse(jsonContent.toString());

    // Verify the JSON contains the expected message mappings
    const helloHash = stableHash("Hello, World!", { hashLength: 10 });
    const goodbyeHash = stableHash("Goodbye!", { hashLength: 10 });

    expect(messagesDict).toEqual({
      [helloHash]: "Hello, World!",
      [goodbyeHash]: "Goodbye!",
    });
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
            loader: "i18next-auto-keys",
            options: {
              include: /\.messages\.ts$/,
            },
          },
        ],
      },
    ];

    const plugin = new I18nextAutoKeyEmitPlugin({
      jsonOutputPath: "i18n/messages.json",
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
        plugins: [plugin],
      }
    );

    // Verify JSON file contains messages from both files
    const jsonContent = fs.readFileSync("/dist/i18n/messages.json", "utf8");
    const messagesDict = JSON.parse(jsonContent.toString());

    expect(Object.keys(messagesDict)).toHaveLength(4);
    expect(Object.values(messagesDict)).toEqual(
      expect.arrayContaining(["Welcome!", "Loading...", "Not found", "Server error"])
    );

    // Verify each message has a proper hash
    Object.keys(messagesDict).forEach((hash) => {
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
            loader: "i18next-auto-keys",
            options: {
              include: /\.messages\.ts$/,
            },
          },
        ],
      },
    ];

    const plugin = new I18nextAutoKeyEmitPlugin({
      jsonOutputPath: "i18n/messages.json",
    });

    const { fs } = await compileWithMemoryFS(
      {
        "src/entry.ts": `import { Messages } from './empty.messages'; console.log("no messages");`,
        "src/empty.messages.ts": `export const Messages = {};`, // No messages
      },
      rules,
      {
        entry: "/src/entry.ts",
        plugins: [plugin],
      }
    );

    // Verify JSON file was still emitted but is empty
    expect(fs.existsSync("/dist/i18n/messages.json")).toBe(true);

    const jsonContent = fs.readFileSync("/dist/i18n/messages.json", "utf8");
    const messagesDict = JSON.parse(jsonContent.toString());

    expect(messagesDict).toEqual({});
  });

  test("should generate JSON with topLevelKey when specified", async () => {
    const rules = [
      {
        test: /\.ts$/,
        use: [
          {
            loader: require.resolve("esbuild-loader"),
            options: {
              loader: "ts",
              target: "es2020",
            },
          },
          {
            loader: "i18next-auto-keys",
            options: {
              include: /\.messages\.ts$/,
            },
          },
        ],
      },
    ];

    const plugin = new I18nextAutoKeyEmitPlugin({
      jsonOutputPath: "i18n/nested.json",
      topLevelKey: "translations",
    });

    const { fs } = await compileWithMemoryFS(
      {
        "src/entry.ts": `
          import { Messages } from './app.messages';
          console.log(Messages.welcome(), Messages.loading());
        `,
        "src/app.messages.ts": `export const Messages = {
          welcome: (): string => "Welcome user!",
          loading: (): string => "Loading data...",
        };`,
      },
      rules,
      {
        entry: "/src/entry.ts",
        plugins: [plugin],
      }
    );

    // Verify JSON file has translations wrapped under topLevelKey
    const jsonContent = fs.readFileSync("/dist/i18n/nested.json", "utf8");
    const parsed = JSON.parse(jsonContent.toString());

    // Should have wrapper object with specified key
    expect(Object.keys(parsed)).toHaveLength(1);
    expect(parsed).toHaveProperty("translations");
    expect(typeof parsed.translations).toBe("object");

    // The actual translations should be nested under the topLevelKey
    const translations = parsed.translations;
    expect(Object.keys(translations)).toHaveLength(2);
    expect(translations).toHaveProperty(stableHash("Welcome user!", { hashLength: 10 }));
    expect(translations).toHaveProperty(stableHash("Loading data...", { hashLength: 10 }));
    expect(translations[stableHash("Welcome user!", { hashLength: 10 })]).toBe("Welcome user!");
    expect(translations[stableHash("Loading data...", { hashLength: 10 })]).toBe("Loading data...");
  });
});
