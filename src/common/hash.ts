import { createHash } from "crypto";

export function stableHash(text: string, context = "", hashLength = 10): string {
  const textToHash = context && context.length > 0 ? `${text}::${context}` : text;
  const h = createHash("sha1").update(textToHash, "utf8").digest("hex");
  return h.slice(0, Math.max(4, hashLength));
}
