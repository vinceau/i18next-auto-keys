import { compileWithMemoryFS } from "./helpers/compile";

describe("i18next-icu-loader pipeline", () => {
  test("works in loader chain with esbuild-loader", async () => {
    const rules = [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          // esbuild-loader compiles TS -> JS (last step)
          {
            loader: require.resolve("esbuild-loader"),
            options: {
              loader: "ts",
              target: "es2020",
            },
          },
          // our loader processes the TypeScript first
          { loader: "i18next-icu-loader", options: { include: /.*/ } },
        ],
      },
    ];

    const result = await compileWithMemoryFS(
      { "src/entry.ts": `export const test: string = "hello";` },
      rules
    );

    // Verify the pipeline worked without errors
    expect(result.stats.hasErrors()).toBe(false);
    expect(result.bundle).toContain("hello");
  });
});