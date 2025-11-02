import type { Compilation } from "webpack";

// Safe helpers for all WP5 variants (and most child compilations)

/** Return an asset record by name, using whatever API exists. */
function findAsset(compilation: Compilation, name: string) {
  const normalized = name.replace(/\\/g, "/");

  if (typeof compilation.getAsset === "function") {
    return compilation.getAsset(normalized); // WP5 modern
  }

  if (typeof compilation.getAssets === "function") {
    const arr = compilation.getAssets(); // WP5 early/mixed
    return arr.find((a: any) => a.name === normalized);
  }

  // Fallback: legacy map still present in all WP5
  if (compilation.assets && compilation.assets[normalized]) {
    return { name: normalized, source: compilation.assets[normalized] };
  }

  return undefined;
}

/** Normalize any Source-like to Buffer for byte comparison. */
function sourceToBuffer(src: any): Buffer {
  const val = typeof src?.source === "function" ? src.source() : src;
  return Buffer.isBuffer(val) ? val : Buffer.from(String(val ?? ""), "utf8");
}

/** Emit only if content changed. Uses updateAsset if available, else emitAsset overwrites. */
export function emitIfChanged(compilation: Compilation, sources: any, name: string, nextBuf: Buffer) {
  const prev = findAsset(compilation, name);
  const nextSrc = new sources.RawSource(nextBuf);

  if (!prev) {
    compilation.emitAsset(name, nextSrc);
    return;
  }

  const prevBuf = sourceToBuffer(prev.source);
  if (!prevBuf.equals(nextBuf)) {
    if (typeof compilation.updateAsset === "function") {
      compilation.updateAsset(name, nextSrc);
    } else {
      // Early WP5: emitAsset will replace
      compilation.emitAsset(name, nextSrc);
    }
  }
}
