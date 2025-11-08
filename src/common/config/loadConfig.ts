// common/loadConfig.ts
import path from "path";
import fs from "fs";
import { cosmiconfigSync } from "cosmiconfig";
import { z } from "zod";

/**
 * Reads the host project's package.json to extract name and version for projectId default.
 * Searches upward from the given directory until package.json is found or reaches filesystem root.
 */
function readHostPackageJson(startDir: string): { name?: string; version?: string } | null {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const packageJsonPath = path.join(currentDir, "package.json");

    try {
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
        return {
          name: packageJson.name,
          version: packageJson.version,
        };
      }
    } catch {
      // Continue searching upward if parsing fails
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Creates a default projectId based on the host project's package.json.
 * Falls back to "app 1.0" if package.json is not found or readable.
 */
function getDefaultProjectId(cwd: string): string {
  const packageInfo = readHostPackageJson(cwd);

  if (packageInfo?.name && packageInfo?.version) {
    return `${packageInfo.name} ${packageInfo.version}`;
  }

  // Fallback to original default
  return "app 1.0";
}

const I18nSchema = z.object({
  poTemplateName: z.string().default("messages.pot"),
  poOutputDirectory: z.string().default("i18n"),
  hashLength: z.number().int().min(10).default(10),
  argMode: z.enum(["indexed", "named"]).default("named"),
  topLevelKey: z.string().optional(),
  projectId: z.string().optional(),
  jsonIndentSpaces: z.number().int().min(0).default(2),
});

export type I18nConfig = z.infer<typeof I18nSchema> & {
  // Ensure projectId is always defined after loadConfig processing
  projectId: string;
};

export type Configuration = { config: I18nConfig; file?: string };

export function loadConfig(cwd = process.cwd()): Configuration {
  const search = cosmiconfigSync("i18next-auto-keys").search(cwd);
  const raw = search?.config ?? {};
  const parsed = I18nSchema.parse(raw);

  // Make paths relative to repo root
  const normalize = (p: string) => path.resolve(cwd, p);

  // Apply dynamic default for projectId if not explicitly configured
  const projectId = parsed.projectId ?? getDefaultProjectId(cwd);

  return {
    file: search?.filepath,
    config: {
      ...parsed,
      projectId,
      poOutputDirectory: normalize(parsed.poOutputDirectory)
    },
  };
}
