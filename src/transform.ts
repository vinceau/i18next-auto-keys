export function transform(
    code: string,
    _opts: { filename?: string; sourcemap?: boolean; inputSourceMap?: object } = {}
  ) {
    // naive but stable for tests - only replace foo with bar, preserve all TypeScript syntax
    const out = code.replace(/\bfoo\b/g, "bar");
    return { code: out, map: undefined };
  }
  