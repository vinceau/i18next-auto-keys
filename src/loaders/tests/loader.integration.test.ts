import { compileWithMemoryFS } from "./helpers/compile";

describe("i18next-icu-loader integration", () => {
  test("loader resolves correctly and processes JS files", async () => {
    const rules = [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [{ loader: "i18next-icu-loader", options: { include: /.*/ } }],
      },
    ];

    // Should not throw errors - loader is found and runs
    await expect(
      compileWithMemoryFS(
        {
          "src/entry.js": `export const test = "hello";`,
        },
        rules
      )
    ).resolves.toBeTruthy();
  });

  test("loader resolves correctly and processes TS files", async () => {
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
          { loader: "i18next-icu-loader", options: { include: /.*/ } },
        ],
      },
    ];

    // Should not throw errors - loader is found and runs
    await expect(
      compileWithMemoryFS(
        {
          "src/entry.ts": `export const test: string = "hello";`,
        },
        rules
      )
    ).resolves.toBeTruthy();
  });

  test("webpack can resolve loader by package name", async () => {
    const rules = [
      {
        test: /\.js$/,
        use: [{ loader: "i18next-icu-loader", options: { include: /.*/ } }],
      },
    ];

    const result = await compileWithMemoryFS(
      {
        "src/entry.js": `console.log("test");`,
      },
      rules,
      { entry: "/src/entry.js" }  // Explicit entry to avoid conflicts
    );

    // Verify webpack compilation succeeded
    expect(result.bundle).toContain('console.log("test")');
    expect(result.stats.hasErrors()).toBe(false);
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
          { loader: "i18next-icu-loader", options: { include: /.*/, sourcemap: true } },
        ],
      },
    ];

    const { map } = await compileWithMemoryFS(
      {
        "src/entry.ts": `export const test: string = "hello";`
      },
      rules
    );

    expect(map).toBeDefined();
    expect(map).toContain('"mappings"');
  });
});