import { createHash } from "crypto";

export function stableHash(text: string, hashLength = 10): string {
  const h = createHash("sha1").update(text, "utf8").digest("hex");
  return h.slice(0, Math.max(4, hashLength));
}

export function stableHashWithContext(source: string, context?: string, hashLength = 10): string {
  const textToHash = context ? `${source}::${context}` : source;
  const h = createHash("sha1").update(textToHash, "utf8").digest("hex");
  return h.slice(0, Math.max(4, hashLength));
}
