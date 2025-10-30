// test/unit.transform2.test.ts

// Mock fs operations to prevent actual file I/O during tests
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

import ts from "typescript";
import fs from "fs";
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

it("respects @noTranslate JSDoc tag", () => {
  const input = `export const Message = {
  /** @noTranslate */
  skip: (): string => "do not translate",

  /** This should be transformed */
  translate: (): string => "translate me",

  /**
   * @noTranslate
   * This function should not be transformed
   */
  alsoSkip: (): string => "also skip",
};`;

  const transformedCode = transformTypeScript(input, {
    onlyMessagesFiles: false,
    hashLength: 10,
  });

  // Functions with @noTranslate should remain unchanged
  expect(transformedCode).toContain('skip: (): string => "do not translate"');
  expect(transformedCode).toContain('alsoSkip: (): string => "also skip"');

  // Functions without @noTranslate should be transformed
  expect(transformedCode).toContain(`translate: (): string => i18next.t("${stableHash('translate me', 10)}")`);

  // Should have i18next import since at least one function was transformed
  expect(transformedCode).toContain('import i18next from "i18next"');
});

it("handles mixed @noTranslate scenarios", () => {
  const input = `export const Message = {
  normal: (): string => "normal message",

  /** @noTranslate */
  debug: (): string => "Debug: internal message",

  user: (): string => "user message",

  /**
   * Some description
   * @noTranslate
   * More description
   */
  internal: (): string => "internal use only",
};`;

  const transformedCode = transformTypeScript(input, {
    onlyMessagesFiles: false,
    hashLength: 10,
  });

  // Normal functions should be transformed
  expect(transformedCode).toContain(`normal: (): string => i18next.t("${stableHash('normal message', 10)}")`);
  expect(transformedCode).toContain(`user: (): string => i18next.t("${stableHash('user message', 10)}")`);

  // Functions with @noTranslate should remain unchanged
  expect(transformedCode).toContain('debug: (): string => "Debug: internal message"');
  expect(transformedCode).toContain('internal: (): string => "internal use only"');

  // Should have i18next import
  expect(transformedCode).toContain('import i18next from "i18next"');
});

it("handles different JSDoc comment styles for @noTranslate", () => {
  const input = `export const Message = {
  /** @noTranslate */
  singleLine: (): string => "single line comment",

  /**
   * @noTranslate
   */
  multiLine: (): string => "multi line comment",

  /**
   * This is a description
   * @noTranslate Some additional text
   * More description
   */
  withDescription: (): string => "with description",

  // This should be transformed (no JSDoc)
  regular: (): string => "regular message",
};`;

  const transformedCode = transformTypeScript(input, {
    onlyMessagesFiles: false,
    hashLength: 10,
  });

  // All @noTranslate functions should remain unchanged
  expect(transformedCode).toContain('singleLine: (): string => "single line comment"');
  expect(transformedCode).toContain('multiLine: (): string => "multi line comment"');
  expect(transformedCode).toContain('withDescription: (): string => "with description"');

  // Regular function should be transformed
  expect(transformedCode).toContain(`regular: (): string => i18next.t("${stableHash('regular message', 10)}")`);

  // Should have i18next import
  expect(transformedCode).toContain('import i18next from "i18next"');
});

it("does not transform any functions when all have @noTranslate", () => {
  const input = `export const Message = {
  /** @noTranslate */
  first: (): string => "first message",

  /** @noTranslate */
  second: (): string => "second message",
};`;

  const transformedCode = transformTypeScript(input, {
    onlyMessagesFiles: false,
    hashLength: 10,
  });

  // All functions should remain unchanged
  expect(transformedCode).toContain('first: (): string => "first message"');
  expect(transformedCode).toContain('second: (): string => "second message"');

  // Should NOT have i18next import since no functions were transformed
  expect(transformedCode).not.toContain('import i18next from "i18next"');
});

it("handles @noTranslate with function expressions", () => {
  const input = `export const Message = {
  /** @noTranslate */
  skipFunction: function(): string { return "skip this"; },

  /** Transform this one */
  transformFunction: function(): string { return "transform this"; },

  /** @noTranslate */
  skipArrow: (): string => "skip arrow",

  transformArrow: (): string => "transform arrow",
};`;

  const transformedCode = transformTypeScript(input, {
    onlyMessagesFiles: false,
    hashLength: 10,
  });

  // Functions with @noTranslate should remain unchanged
  expect(transformedCode).toContain('skipFunction: function (): string { return "skip this"; }');
  expect(transformedCode).toContain('skipArrow: (): string => "skip arrow"');

  // Functions without @noTranslate should be transformed
  // Function expressions get formatted with proper indentation by TypeScript printer
  expect(transformedCode).toContain(`return i18next.t("${stableHash('transform this', 10)}");`);
  expect(transformedCode).toMatch(/transformFunction:\s*function\s*\(\):\s*string\s*\{\s*return\s*i18next\.t\(/);
  expect(transformedCode).toContain(`transformArrow: (): string => i18next.t("${stableHash('transform arrow', 10)}")`);

  // Should have i18next import
  expect(transformedCode).toContain('import i18next from "i18next"');
});

describe("argument parsing modes", () => {
  it("handles array mode with no parameters", () => {
    const input = `export const Message = {
  greeting: (): string => "Hello",
};`;

    const transformedCode = transformTypeScript(input, {
      onlyMessagesFiles: false,
      hashLength: 10,
      argMode: "array",
    });

    // No parameters means no second argument to i18next.t
    expect(transformedCode).toContain(`greeting: (): string => i18next.t("${stableHash('Hello', 10)}")`);
    expect(transformedCode).not.toContain('i18next.t("' + stableHash('Hello', 10) + '", ');
  });

  it("handles named mode with no parameters", () => {
    const input = `export const Message = {
  greeting: (): string => "Hello",
};`;

    const transformedCode = transformTypeScript(input, {
      onlyMessagesFiles: false,
      hashLength: 10,
      argMode: "named",
    });

    // No parameters means no second argument to i18next.t
    expect(transformedCode).toContain(`greeting: (): string => i18next.t("${stableHash('Hello', 10)}")`);
    expect(transformedCode).not.toContain('i18next.t("' + stableHash('Hello', 10) + '", ');
  });

  it("handles array mode with single parameter", () => {
    const input = `export const Message = {
  greeting: (name: string): string => "Hello",
};`;

    const transformedCode = transformTypeScript(input, {
      onlyMessagesFiles: false,
      hashLength: 10,
      argMode: "array",
    });

    // Single parameter should be passed as array
    expect(transformedCode).toContain(`greeting: (name: string): string => i18next.t("${stableHash('Hello', 10)}", [name])`);
  });

  it("handles named mode with single parameter", () => {
    const input = `export const Message = {
  greeting: (name: string): string => "Hello",
};`;

    const transformedCode = transformTypeScript(input, {
      onlyMessagesFiles: false,
      hashLength: 10,
      argMode: "named",
    });

    // Single parameter should be passed as object (TypeScript printer formats with newlines)
    expect(transformedCode).toContain(`i18next.t("${stableHash('Hello', 10)}", {`);
    expect(transformedCode).toContain('name');
  });

  it("handles array mode with multiple parameters", () => {
    const input = `export const Message = {
  greeting: (name: string, age: number): string => "Hello",
};`;

    const transformedCode = transformTypeScript(input, {
      onlyMessagesFiles: false,
      hashLength: 10,
      argMode: "array",
    });

    // Multiple parameters should be passed as array
    expect(transformedCode).toContain(`greeting: (name: string, age: number): string => i18next.t("${stableHash('Hello', 10)}", [name, age])`);
  });

  it("handles named mode with multiple parameters", () => {
    const input = `export const Message = {
  greeting: (name: string, age: number): string => "Hello",
};`;

    const transformedCode = transformTypeScript(input, {
      onlyMessagesFiles: false,
      hashLength: 10,
      argMode: "named",
    });

    // Multiple parameters should be passed as object with shorthand properties (flexible formatting)
    expect(transformedCode).toContain(`i18next.t("${stableHash('Hello', 10)}", {`);
    expect(transformedCode).toMatch(/greeting:.*name.*age.*\}/s);
  });

  it("handles mixed parameter scenarios in array mode", () => {
    const input = `export const Message = {
  noParams: (): string => "No params",
  oneParam: (name: string): string => "One param",
  twoParams: (name: string, count: number): string => "Two params",
};`;

    const transformedCode = transformTypeScript(input, {
      onlyMessagesFiles: false,
      hashLength: 10,
      argMode: "array",
    });

    // No params - no second argument
    expect(transformedCode).toContain(`noParams: (): string => i18next.t("${stableHash('No params', 10)}")`);

    // One param - array with single element
    expect(transformedCode).toContain(`oneParam: (name: string): string => i18next.t("${stableHash('One param', 10)}", [name])`);

    // Two params - array with two elements
    expect(transformedCode).toContain(`twoParams: (name: string, count: number): string => i18next.t("${stableHash('Two params', 10)}", [name, count])`);
  });

  it("handles mixed parameter scenarios in named mode", () => {
    const input = `export const Message = {
  noParams: (): string => "No params",
  oneParam: (name: string): string => "One param",
  twoParams: (name: string, count: number): string => "Two params",
};`;

    const transformedCode = transformTypeScript(input, {
      onlyMessagesFiles: false,
      hashLength: 10,
      argMode: "named",
    });

    // No params - no second argument
    expect(transformedCode).toContain(`noParams: (): string => i18next.t("${stableHash('No params', 10)}")`);

    // One param - object with single property (TypeScript printer formats with newlines)
    expect(transformedCode).toContain(`i18next.t("${stableHash('One param', 10)}", {`);
    expect(transformedCode).toMatch(/oneParam:.*name.*\}/s);

    // Two params - object with two properties (flexible formatting)
    expect(transformedCode).toContain(`i18next.t("${stableHash('Two params', 10)}", {`);
    expect(transformedCode).toMatch(/twoParams:.*name.*count.*\}/s);
  });

  it("handles function expressions with parameters in array mode", () => {
    const input = `export const Message = {
  greeting: function(name: string, age: number): string { return "Hello"; },
};`;

    const transformedCode = transformTypeScript(input, {
      onlyMessagesFiles: false,
      hashLength: 10,
      argMode: "array",
    });

    // Function expression with parameters should use array mode
    expect(transformedCode).toContain(`return i18next.t("${stableHash('Hello', 10)}", [name, age]);`);
  });

  it("handles function expressions with parameters in named mode", () => {
    const input = `export const Message = {
  greeting: function(name: string, age: number): string { return "Hello"; },
};`;

    const transformedCode = transformTypeScript(input, {
      onlyMessagesFiles: false,
      hashLength: 10,
      argMode: "named",
    });

    // Function expression with parameters should use named mode (flexible formatting)
    expect(transformedCode).toContain(`return i18next.t("${stableHash('Hello', 10)}", {`);
    expect(transformedCode).toMatch(/name.*age.*\}/s);
  });

  it("defaults to array mode when argMode is not specified", () => {
    const input = `export const Message = {
  greeting: (name: string): string => "Hello",
};`;

    const transformedCode = transformTypeScript(input, {
      onlyMessagesFiles: false,
      hashLength: 10,
      // argMode not specified - should default to "array"
    });

    // Should use array mode by default
    expect(transformedCode).toContain(`greeting: (name: string): string => i18next.t("${stableHash('Hello', 10)}", [name])`);
  });
});
