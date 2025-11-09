import { createHash } from "crypto";

// optional: reduce churn from harmless edits
function normalizeForHash(s: string) {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}(),])\s*/g, "$1") // ICU punctuation spacing
    .trim();
}

export function stableHash(
  text: string,
  options: { context?: string; normalize?: boolean; hashLength?: number } = {}
): string {
  const { context = "", normalize = false, hashLength = 10 } = options;
  const normalizedText = normalize ? normalizeForHash(text) : text;
  const textToHash = context && context.length > 0 ? `${normalizedText}::${context}` : normalizedText;
  const h = createHash("sha1").update(textToHash, "utf8").digest("hex");
  return h.slice(0, Math.max(4, hashLength));
}
