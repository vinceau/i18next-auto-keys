import { createHash } from "crypto";

export function stableHash(text: string, hashLength = 16): string {
    const h = createHash("sha1").update(text, "utf8").digest("hex");
    return h.slice(0, Math.max(4, hashLength));
}
