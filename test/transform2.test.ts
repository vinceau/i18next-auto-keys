// test/unit.transform2.test.ts

// Mock fs operations to prevent actual file I/O during tests
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

import * as ts from "typescript";
import * as fs from "fs";
import i18nMessagesTransformer from "../src/transform2";
import { stableHash } from "../src/hash";

const mockedFs = fs as jest.Mocked<typeof fs>;

function transformTypeScript(sourceCode: string, transformerOptions: any): string {
  const fileName = 'test.messages.ts';
  
  // Create in-memory source file
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceCode,
    ts.ScriptTarget.ES2020,
    true // setParentNodes
  );
  
  // Create in-memory compiler host
  const compilerHost: ts.CompilerHost = {
    getSourceFile: (name) => name === fileName ? sourceFile : undefined,
    writeFile: () => {}, // No-op for in-memory
    getCurrentDirectory: () => '',
    getDirectories: () => [],
    fileExists: (name) => name === fileName,
    readFile: (name) => name === fileName ? sourceCode : undefined,
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    getDefaultLibFileName: () => 'lib.d.ts',
    resolveModuleNames: () => [],
  };
  
  // Create TypeScript program with in-memory host
  const program = ts.createProgram([fileName], {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ES2020,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    noLib: true, // Skip loading standard library for testing
  }, compilerHost);
  
  // Apply transformer with mock output paths (won't be used in memory)
  const transformer = i18nMessagesTransformer(program, {
    ...transformerOptions,
    jsonOutputPath: '/mock/output.json',
    xliffOutputPath: '/mock/output.xliff',
  });
  
  // Transform the source file
  const result = ts.transform(sourceFile, [transformer]);
  const transformedSourceFile = result.transformed[0] as ts.SourceFile;
  
  // Print the transformed code
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const transformedCode = printer.printFile(transformedSourceFile);
  
  result.dispose();
  return transformedCode;
}

beforeEach(() => {
  mockedFs.mkdirSync.mockClear();
  mockedFs.writeFileSync.mockClear();
});

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
