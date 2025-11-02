import { compileWithMemoryFS } from "./helpers/compile";

describe("i18next-auto-keys loader integration", () => {
  test("transforms .messages.js files correctly", async () => {
    const rules = [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [{ loader: "i18next-auto-keys", options: { include: /\.messages\.js$/, hashLength: 10 } }],
      },
    ];

    const { bundle } = await compileWithMemoryFS(
      {
        "src/entry.js": `import { Messages } from './ui.messages.js'; console.log(Messages.greeting());`,
        "src/ui.messages.js": `export const Messages = { greeting: () => "Hello, World!" };`,
      },
      rules,
      { entry: "/src/entry.js" }
    );

    // Verify transformation happened (webpack mangles import names)
    expect(bundle).toMatch(/\.t\(["'][a-f0-9]{10}["']\)/); // Should contain .t() calls with hash
    expect(bundle).not.toContain("Hello, World!"); // Original string should be replaced
    expect(bundle).toContain('i18next'); // Should reference i18next (webpack externals)
  });

  test("transforms .messages.ts files correctly", async () => {
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
              argMode: "array"
            }
          },
        ],
      },
    ];

    const { bundle } = await compileWithMemoryFS(
      {
        "src/entry.ts": `import { Messages } from './ui.messages'; console.log(Messages.welcome());`,
        "src/ui.messages.ts": `export const Messages = {
          welcome: (): string => "Welcome to our app!",
          goodbye: (): string => "Goodbye!",
        };`,
      },
      rules,
      { entry: "/src/entry.ts" }
    );

    // Verify transformations happened
    expect(bundle).toMatch(/\.t\(["'][a-f0-9]{10}["']\)/); // Should contain .t() calls with hash
    expect(bundle).not.toContain("Welcome to our app!"); // Original strings should be replaced
    expect(bundle).not.toContain("Goodbye!");
    expect(bundle).toContain('i18next'); // Should reference i18next
  });

  test("transforms messages with parameters correctly", async () => {
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
              argMode: "named"
            }
          },
        ],
      },
    ];

    const { bundle } = await compileWithMemoryFS(
      {
        "src/entry.ts": `import { Messages } from './user.messages'; console.log(Messages.greeting({ name: "John" }));`,
        "src/user.messages.ts": `export const Messages = {
          greeting: (name: string): string => "Hello",
          itemCount: (count: number): string => "You have items",
        };`,
      },
      rules,
      { entry: "/src/entry.ts" }
    );

    // Verify transformations work (even with parameters, simple string literals are transformed)
    expect(bundle).toMatch(/\.t\(["'][a-f0-9]{10}["']/); // Should contain .t() calls with hash
    expect(bundle).not.toContain('"Hello"'); // String literals should be replaced
    expect(bundle).not.toContain('"You have items"');
    expect(bundle).toContain('i18next'); // Should reference i18next
  });

  test("only transforms files matching include pattern", async () => {
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
              hashLength: 10
            }
          },
        ],
      },
    ];

    const { bundle } = await compileWithMemoryFS(
      {
        "src/entry.ts": `import { Messages } from './ui.messages'; import { Utils } from './utils'; console.log(Messages.greeting(), Utils.helper());`,
        "src/ui.messages.ts": `export const Messages = { greeting: (): string => "Hello!" };`,
        "src/utils.ts": `export const Utils = { helper: (): string => "This should not be transformed" };`, // This should NOT be transformed
      },
      rules,
      { entry: "/src/entry.ts" }
    );

    // Should transform messages file but not utils file
    expect(bundle).toMatch(/\.t\(["'][a-f0-9]{10}["']\)/); // Should contain .t() for messages
    expect(bundle).not.toContain("Hello!"); // Messages should be transformed
    expect(bundle).toContain("This should not be transformed"); // Utils should remain unchanged
  });

  test("emits source maps when requested", async () => {
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
              sourcemap: true,
              hashLength: 10
            }
          },
        ],
      },
    ];

    const { map } = await compileWithMemoryFS(
      {
        "src/entry.ts": `import { Messages } from './test.messages'; console.log(Messages.test());`,
        "src/test.messages.ts": `export const Messages = { test: (): string => "Test message" };`
      },
      rules,
      { entry: "/src/entry.ts" }
    );

    expect(map).toBeDefined();
    expect(map).toContain('"mappings"');
  });
});