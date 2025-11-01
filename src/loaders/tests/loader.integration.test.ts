import { compileWithMemoryFS } from "./helpers/compile";

const loaderPath = require.resolve("../dist/loader.js");

describe("i18next-icu-loader (direct on JS/TS)", () => {
  test("transforms JS", async () => {
    const rules = [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: [{ loader: loaderPath, options: { sourcemap: true } }],
      },
    ];

    const { bundle } = await compileWithMemoryFS(
      {
        "src/entry.js": `import { foo } from './lib.js'; console.log(foo);`,
        "src/lib.js": `export const foo = 42;`,
      },
      rules
    );

    expect(bundle).toContain("bar");
    expect(bundle).not.toContain("foo");
  });

  test("transforms TS", async () => {
    const rules = [
      {
        oneOf: [
          // TS: our loader (transform) -> esbuild-loader (compile)
          {
            test: /\.tsx?$/,
            exclude: /node_modules/,
            use: [
              {
                loader: require.resolve("esbuild-loader"),
                options: {
                  loader: "ts",
                  target: "es2020",
                },
              },
              { loader: loaderPath, options: { sourcemap: true } },
            ],
          },
          // JS: only our loader
          {
            test: /\.jsx?$/,
            exclude: /node_modules/,
            use: [{ loader: loaderPath, options: { sourcemap: true } }],
          },
        ],
      },
    ];

    const { bundle } = await compileWithMemoryFS(
      {
        "src/entry.ts": `
          const foo: number = 123;
          export default foo;
        `,
      },
      rules
    );

    expect(bundle).toContain("bar");
    expect(bundle).not.toContain("foo");
  });

  test("emits source maps", async () => {
    const rules = [
      {
        oneOf: [
          {
            test: /\.tsx?$/,
            exclude: /node_modules/,
            use: [
              {
                loader: require.resolve("esbuild-loader"),
                options: {
                  loader: "ts",
                  target: "es2020",
                },
              },
              { loader: loaderPath, options: { sourcemap: true } },
            ],
          },
          {
            test: /\.jsx?$/,
            exclude: /node_modules/,
            use: [{ loader: loaderPath, options: { sourcemap: true } }],
          },
        ],
      },
    ];

    const { map } = await compileWithMemoryFS(
      { "src/entry.ts": `const foo: number = 1; console.log(foo);` },
      rules
    );

    expect(map).toBeDefined();
  });
});
