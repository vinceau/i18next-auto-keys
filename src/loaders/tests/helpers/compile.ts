import path from "node:path";
import webpack, { Configuration } from "webpack";
import { Volume } from "memfs";
import { ufs } from "unionfs";
import realfs from "fs";

// Absolute path to the built loader for testing
const LOADER_PATH = path.resolve(__dirname, '../../../../dist/index.js');

export async function compileWithMemoryFS(
  entryFiles: Record<string, string>,
  rules: NonNullable<Configuration["module"]>["rules"],
  extra?: Partial<Configuration>
) {
  // Auto-detect entry point from the files provided, prefer explicit entry config
  const explicitEntry = extra?.entry;
  const entryFile = explicitEntry
    ? (typeof explicitEntry === 'string' ? explicitEntry.replace(/^\//, '') : Object.keys(entryFiles)[0])
    : (Object.keys(entryFiles).find(f => f.startsWith('src/entry')) || Object.keys(entryFiles)[0]);
  const entryPath = explicitEntry || ("/" + entryFile.replace(/^\//, "").replace(/\.[^/.]+$/, ""));
  const vol = new Volume();

  // ✅ Memfs MUST take precedence over the real FS
  const mem = ufs.use(vol as any).use(realfs as any);

  // Seed the virtual project files
  for (const [file, contents] of Object.entries(entryFiles)) {
    const full = "/" + file.replace(/^\//, "");
    vol.mkdirSync(path.dirname(full), { recursive: true });
    vol.writeFileSync(full, contents);
  }

  // Note: We pass compiler options directly to ts-loader instead of using a virtual tsconfig

  const config: Configuration = {
    mode: "development",
    context: "/",
    entry: entryPath,
    output: { path: "/dist", filename: "bundle.js" },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"]
    },
    resolveLoader: {
      alias: {
        "i18next-icu-loader": LOADER_PATH
      }
    },
    externals: {
      // Treat i18next as external to avoid resolution errors
      "i18next": "i18next"
    },
    module: { rules },
    devtool: "source-map",
    infrastructureLogging: { level: "error" },
    stats: "errors-warnings",
    ...extra,
  };

  const compiler = webpack(config);
  if (!compiler) throw new Error("Failed to create webpack compiler");

  // Hook memfs into webpack
  // @ts-ignore
  compiler.inputFileSystem = mem;
  // @ts-ignore
  compiler.outputFileSystem = mem;

  const stats = await new Promise<webpack.Stats>((resolve, reject) => {
    compiler.run((err, s) => {
      compiler.close(() => {});
      if (err) return reject(err);
      if (!s) return reject(new Error("No stats"));
      const info = s.toJson({ all: false, errors: true });
      if (s.hasErrors()) {
        return reject(
          new Error(
            "Webpack errors:\n" +
              (info.errors ?? [])
                .map((e: any) => e?.message ?? String(e))
                .join("\n")
          )
        );
      }
      resolve(s);
    });
  });

  const bundle = vol.readFileSync("/dist/bundle.js", "utf8");
  let map: string | undefined;
  try {
    map = vol.readFileSync("/dist/bundle.js.map", "utf8").toString();
  } catch {
    // ignore
  }
  return { stats, bundle, map, fs: vol };
}
