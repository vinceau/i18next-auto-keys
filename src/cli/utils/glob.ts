import path from "path";

/**
 * Normalizes a glob pattern to use forward slashes for cross-platform compatibility.
 * 
 * On Windows, path.join() creates paths with backslashes (e.g., "C:\locales\*.po"),
 * but the glob library requires forward slashes in patterns to work correctly.
 * This function converts platform-specific separators to POSIX-style forward slashes.
 * 
 * @param pattern - Glob pattern with platform-specific separators
 * @returns Normalized pattern with forward slashes
 * 
 * @example
 * // On Windows
 * normalizeGlobPattern("C:\\locales\\*.po") // "C:/locales/*.po"
 * 
 * // On Unix (no change needed)
 * normalizeGlobPattern("/locales/*.po") // "/locales/*.po"
 */
export function normalizeGlobPattern(pattern: string): string {
  return pattern
    .split(path.sep)
    .join(path.posix.sep);
}

