import { compileWithMemoryFS } from "../../loaders/tests/helpers/compile";
import { stableHash } from "../../common/hash";

// Import from the SAME path that the bundled loader uses to ensure same instance
const LOADER_PATH = require.resolve("../../../dist/index.js");
const { I18nextAutoKeyEmitPlugin } = require(LOADER_PATH);

// Mock gettext-parser to work in test environment
const mockPotContent = `msgid ""
msgstr ""
"Project-Id-Version: test-app 1.0\\n"
"mime-version: 1.0\\n"
"Content-Type: text/plain; charset=utf-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"x-generator: I18nextAutoKeyEmitPlugin\\n"
"Language: \\n"

#: src/ui.messages.ts:2:35
msgctxt "0b1cf27300"
msgid "Welcome to our app!"
msgstr ""

#: src/ui.messages.ts:3:33
msgctxt "20c7c5522f"
msgid "Ready"
msgstr ""
`;

jest.mock(
  "gettext-parser",
  () => ({
    po: {
      compile: jest.fn().mockImplementation((catalog) => {
        // Verify the catalog structure is correct
        expect(catalog.charset).toBe("utf-8");
        expect(catalog.headers).toMatchObject({
          "project-id-version": "test-app 1.0",
          "mime-version": "1.0",
          "content-type": "text/plain; charset=UTF-8",
          "content-transfer-encoding": "8bit",
          "x-generator": "I18nextAutoKeyEmitPlugin",
          language: "",
        });

        // Verify translations structure
        expect(catalog.translations[""]).toBeDefined();

        // Return mock POT content as Buffer
        return Buffer.from(mockPotContent);
      }),
    },
  }),
  { virtual: true }
);

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
              hashLength: 10,
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
            loader: "i18next-auto-keys",
            options: {
              include: /\.messages\.ts$/,
              hashLength: 10,
            },
          },
        ],
      },
    ];

    const plugin = new I18nextAutoKeyEmitPlugin({
      jsonOutputPath: "i18n/messages.json",
      potOutputPath: "i18n/messages.pot",
      projectIdVersion: "test-app 1.0",
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
        plugins: [plugin],
      }
    );

    // Verify POT file was emitted with mocked gettext-parser
    expect(fs.existsSync("/dist/i18n/messages.pot")).toBe(true);
    const potContent = fs.readFileSync("/dist/i18n/messages.pot", "utf8").toString();

    // Verify POT file contains expected structure
    expect(potContent).toContain("Project-Id-Version: test-app 1.0");
    expect(potContent).toContain("Content-Type: text/plain; charset=utf-8");
    expect(potContent).toContain("x-generator: I18nextAutoKeyEmitPlugin");

    // Verify it contains our messages
    expect(potContent).toContain("Welcome to our app!");
    expect(potContent).toContain("Ready");

    // Verify msgctxt (hashes) are present
    const welcomeHash = stableHash("Welcome to our app!", 10);
    const readyHash = stableHash("Ready", 10);
    expect(potContent).toContain(`msgctxt "${welcomeHash}"`);
    expect(potContent).toContain(`msgctxt "${readyHash}"`);

    // Verify the mock was called (meaning our POT generation logic executed)
    const gettextParser = require("gettext-parser");
    expect(gettextParser.po.compile).toHaveBeenCalledWith(
      expect.objectContaining({
        charset: "utf-8",
        headers: expect.objectContaining({
          "project-id-version": "test-app 1.0",
          "x-generator": "I18nextAutoKeyEmitPlugin",
        }),
        translations: expect.objectContaining({
          "": expect.any(Object),
        }),
      })
    );
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
              hashLength: 10,
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
              hashLength: 10,
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
              hashLength: 10,
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
    expect(translations).toHaveProperty(stableHash("Welcome user!", 10));
    expect(translations).toHaveProperty(stableHash("Loading data...", 10));
    expect(translations[stableHash("Welcome user!", 10)]).toBe("Welcome user!");
    expect(translations[stableHash("Loading data...", 10)]).toBe("Loading data...");
  });
});
