// test/unit.transform2.test.ts
import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import i18nMessagesTransformer from "../src/transform2";
import { stableHash } from "../src/hash";

function transformTypeScript(sourceCode: string, transformerOptions: any): string {
  // Create a temporary file
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transform-test-'));
  const tempFile = path.join(tempDir, 'test.messages.ts');
  const outputJsonPath = path.join(tempDir, 'output.json');
  const outputXliffPath = path.join(tempDir, 'output.xliff');
  
  try {
    // Write source to temp file
    fs.writeFileSync(tempFile, sourceCode);
    
    // Create TypeScript program
    const program = ts.createProgram([tempFile], {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ES2020,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    });
    
    // Apply transformer
    const transformer = i18nMessagesTransformer(program, {
      ...transformerOptions,
      jsonOutputPath: outputJsonPath,
      xliffOutputPath: outputXliffPath,
    });
    
    // Transform the source file
    const sourceFile = program.getSourceFile(tempFile);
    if (!sourceFile) {
      throw new Error('Could not find source file');
    }
    
    const result = ts.transform(sourceFile, [transformer]);
    const transformedSourceFile = result.transformed[0] as ts.SourceFile;
    
    // Print the transformed code
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const transformedCode = printer.printFile(transformedSourceFile);
    
    result.dispose();
    return transformedCode;
  } finally {
    // Cleanup temp files
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      if (fs.existsSync(outputJsonPath)) fs.unlinkSync(outputJsonPath);
      if (fs.existsSync(outputXliffPath)) fs.unlinkSync(outputXliffPath);
      fs.rmdirSync(tempDir);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

it("transforms TS message functions", () => {
  const input = `export const Message = {
  foo: (): string => "foo",
  bar: (): string => "bar",
};`;

  const transformedCode = transformTypeScript(input, {
    onlyMessagesFiles: false, // Allow transformation of any file
    hashLength: 10,
  });

  // Check that the functions were transformed to use i18next.t (with type annotations preserved)
  expect(transformedCode).toContain(`foo: (): string => i18next.t("${stableHash('foo', 10)}")`);
  expect(transformedCode).toContain(`bar: (): string => i18next.t("${stableHash('bar', 10)}")`);
  
  // Check that i18next import was added
  expect(transformedCode).toContain('import i18next from "i18next"');
});

it("preserves functions that don't return string literals", () => {
  const input = `export const Message = {
  foo: (): string => "foo",
  dynamic: (name: string): string => \`Hello \${name}\`,
  computed: (): string => Math.random().toString(),
};`;

  const transformedCode = transformTypeScript(input, {
    onlyMessagesFiles: false,
    hashLength: 10,
  });

  // Only foo should be transformed (with type annotations preserved)
  expect(transformedCode).toContain(`foo: (): string => i18next.t("${stableHash('foo', 10)}")`);
  
  // Dynamic and computed should remain unchanged
  expect(transformedCode).toContain('dynamic: (name: string): string => `Hello ${name}`');
  expect(transformedCode).toContain('computed: (): string => Math.random().toString()');
});
