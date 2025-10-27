import { compileWithMemoryFS } from "./helpers/compile";

const loaderPath = require.resolve("../dist/loader.js");

describe("i18next-icu-loader pipeline with esbuild", () => {
  test("transforms TS then compiles with esbuild-loader", async () => {
    const rules = [
      {
        test: /\.tsx?$/,
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
          // our loader transforms foo -> bar (first step)
          { loader: loaderPath, options: { sourcemap: true } },
        ],
      },
    ];

    const { bundle } = await compileWithMemoryFS(
      { "src/entry.ts": `const foo: number = 99; console.log(foo)` },
      rules
    );

    expect(bundle).toContain("bar");
    expect(bundle).not.toContain("foo");
  });
});
