import { compileWithMemoryFS } from "./helpers/compile";

describe("i18next-auto-keys loader pipeline", () => {
  test("transforms .messages.ts files then compiles with esbuild-loader", async () => {
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
          // our loader transforms message functions to i18next.t() calls (first step)
          {
            loader: "i18next-auto-keys",
            options: {
              include: /\.messages\.ts$/,
              argMode: "indexed",
            },
          },
        ],
      },
    ];

    const { bundle } = await compileWithMemoryFS(
      {
        "src/app.messages.ts": `export const Messages = {
          hello: (): string => "Hello",
          welcome: (name: string): string => \`Welcome, \${name}!\`
        };`,
      },
      rules,
      { entry: "/src/app.messages.ts" }
    );

    // Verify the pipeline worked: transformation -> compilation (webpack mangles imports)
    expect(bundle).toMatch(/\.t\(["'][a-f0-9]{10}["']\)/); // Should transform to .t() calls with hash
    expect(bundle).not.toContain("Hello"); // Original strings should be replaced
    expect(bundle).toContain("i18next"); // Should reference i18next
  });
});
