// common/loadConfig.ts
import path from "path";
import { cosmiconfigSync } from "cosmiconfig";
import { z } from "zod";

import pkg from "../../../package.json";

const I18nSchema = z.object({
  potTemplatePath: z.string().default("i18n/messages.pot"),
  hashLength: z.number().int().min(10).default(10),
  argMode: z.enum(["indexed", "named"]).default("named"),
  topLevelKey: z.string().optional(),
  projectId: z.string().optional().default("app 1.0"),
  jsonIndentSpaces: z.number().int().min(0).default(2),
});

export type I18nConfig = z.infer<typeof I18nSchema>;

export function loadConfig(cwd = process.cwd()): { config: I18nConfig; file?: string } {
  const search = cosmiconfigSync(pkg.name).search(cwd);
  const raw = search?.config ?? {};
  const parsed = I18nSchema.parse(raw);
  // Make paths relative to repo root
  const normalize = (p: string) => path.resolve(cwd, p);
  return {
    file: search?.filepath,
    config: { ...parsed, potTemplatePath: normalize(parsed.potTemplatePath) },
  };
}
