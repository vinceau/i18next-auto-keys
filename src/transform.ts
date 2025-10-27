import { SourceMapGenerator, SourceMapConsumer } from "source-map";

export function transform(
    code: string,
    opts: { filename?: string; sourcemap?: boolean; inputSourceMap?: any } = {}
  ) {
    // naive but stable for tests - only replace foo with bar, preserve all TypeScript syntax
    const out = code.replace(/\bfoo\b/g, "bar");
    
    if (!opts.sourcemap) {
      return { code: out, map: undefined };
    }
    
    // Since "foo" and "bar" have the same length, the transformation preserves
    // line and column positions exactly - we can create a simple identity mapping
    const filename = opts.filename || "input.js";
    
    // If we have an input source map, just pass it through since our transformation
    // doesn't change positions (foo->bar same length)
    if (opts.inputSourceMap) {
      return { code: out, map: opts.inputSourceMap };
    }
    
    // Generate a simple source map that maps every position to itself
    const generator = new SourceMapGenerator({
      file: filename,
      sourceRoot: ""
    });
    
    generator.setSourceContent(filename, code);
    
    // Add identity mappings for each line
    const lines = code.split('\n');
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      for (let columnIndex = 0; columnIndex < line.length; columnIndex++) {
        generator.addMapping({
          source: filename,
          original: { line: lineIndex + 1, column: columnIndex },
          generated: { line: lineIndex + 1, column: columnIndex }
        });
      }
    }
    
    return { code: out, map: generator.toJSON() };
  }
  