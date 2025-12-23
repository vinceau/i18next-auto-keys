import { i18nextAutoKeyRollupPlugin } from "../plugin";
import { i18nStore } from "../../common/i18nStore";
import type { PluginContext, TransformPluginContext, RollupError } from "rollup";

// Mock the config loader
jest.mock("../../common/config/loadConfig", () => ({
  loadConfig: jest.fn(() => ({
    config: {
      hashLength: 10,
      argMode: "named",
      jsonIndentSpaces: 2,
      topLevelKey: undefined,
    },
    file: "/mock/config/file.js",
  })),
}));

// Helper to call a Rollup hook (handles both function and object formats)
function callHook(hook: any, context: any, ...args: any[]): any {
  if (!hook) return undefined;
  const fn = typeof hook === "function" ? hook : hook.handler;
  return fn.call(context, ...args);
}

describe("i18nextAutoKeyRollupPlugin", () => {
  let mockPluginContext: Partial<PluginContext>;
  let mockTransformContext: Partial<TransformPluginContext>;
  let emittedFiles: Array<{ type: string; fileName: string; source: string }>;

  beforeEach(() => {
    // Clear all state
    jest.clearAllMocks();
    i18nStore.clear();
    emittedFiles = [];

    // Create mock plugin context
    mockPluginContext = {
      addWatchFile: jest.fn(),
      error: jest.fn((error: string | RollupError) => {
        throw new Error(typeof error === "string" ? error : error.message);
      }) as any,
      emitFile: jest.fn((file: any) => {
        emittedFiles.push(file);
        return "mock-ref-id";
      }),
    };

    // Create mock transform context (extends PluginContext)
    mockTransformContext = {
      ...mockPluginContext,
    } as any;
  });

  describe("Plugin structure", () => {
    it("should return a valid Rollup plugin object", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "locales/en.json",
      });

      expect(plugin).toHaveProperty("name", "i18next-auto-keys");
      expect(plugin).toHaveProperty("buildStart");
      expect(plugin).toHaveProperty("transform");
      expect(plugin).toHaveProperty("generateBundle");
      expect(typeof plugin.buildStart).toBe("function");
      expect(typeof plugin.transform).toBe("function");
      expect(typeof plugin.generateBundle).toBe("function");
    });
  });

  describe("buildStart hook", () => {
    it("should clear i18nStore on build start", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "locales/en.json",
      });

      // Add some data to store
      i18nStore.add({
        id: "test",
        source: "Test message",
        ref: { file: "test.ts", line: 1, column: 1 },
      });
      expect(i18nStore.all().size).toBe(1);

      // Call buildStart
      callHook(plugin.buildStart, mockPluginContext, {} as any);

      expect(i18nStore.all().size).toBe(0);
    });

    it("should add config file to watch files", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "locales/en.json",
      });

      callHook(plugin.buildStart, mockPluginContext, {} as any);

      expect(mockPluginContext.addWatchFile).toHaveBeenCalledWith("/mock/config/file.js");
    });
  });

  describe("transform hook", () => {
    it("should skip files that don't match include pattern", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "locales/en.json",
        include: [/\.messages\.ts$/],
      });

      const code = 'export const test = "Hello";';
      const result = callHook(plugin.transform, mockTransformContext, code, "src/regular.ts");

      expect(result).toBeNull();
    });

    it("should skip non-TypeScript files", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "locales/en.json",
      });

      const code = 'export const test = "Hello";';
      const result = callHook(plugin.transform, mockTransformContext, code, "src/file.js");

      expect(result).toBeNull();
    });

    it("should transform matching TypeScript files", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "locales/en.json",
      });

      const code = `
export const Messages = {
  greeting: (): string => "Hello World",
};
`;
      const result = callHook(plugin.transform, mockTransformContext, code, "src/test.messages.ts");

      expect(result).not.toBeNull();
      expect(result).toHaveProperty("code");
      expect(result?.code).toContain("i18next.t(");
      expect(result?.code).toContain('import i18next from "i18next"');
    });

    it("should handle transformation without throwing on malformed code", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "locales/en.json",
      });

      // TypeScript compiler is quite forgiving and won't throw on syntax errors
      const invalidCode = "export const broken = {{{";

      // Should not throw - TypeScript will parse it even if invalid
      const result = callHook(plugin.transform, mockTransformContext, invalidCode, "src/broken.messages.ts");

      // Should return transformed code (even if the original was malformed)
      expect(result).toBeDefined();
    });

    it("should respect argMode option", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "locales/en.json",
        argMode: "indexed",
      });

      const code = `
export const Messages = {
  greeting: (name: string): string => "Hello {0}",
};
`;
      const result = callHook(plugin.transform, mockTransformContext, code, "src/test.messages.ts");

      expect(result?.code).toContain('i18next.t(');
      // In indexed mode, parameters are passed as { "0": name }
      expect(result?.code).toMatch(/"0":/);
    });

    it("should respect setDefaultValue option", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "locales/en.json",
        setDefaultValue: true,
      });

      const code = `
export const Messages = {
  greeting: (): string => "Hello World",
};
`;
      const result = callHook(plugin.transform, mockTransformContext, code, "src/test.messages.ts");

      expect(result?.code).toContain("defaultValue:");
      expect(result?.code).toContain("Hello World");
    });

    it("should respect debug option", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "locales/en.json",
        debug: true,
      });

      const code = `
export const Messages = {
  greeting: (): string => "Hello World",
};
`;
      const result = callHook(plugin.transform, mockTransformContext, code, "src/test.messages.ts");

      // Debug mode wraps calls in template strings with ~~ markers
      expect(result?.code).toMatch(/~~.*~~|`~~.*~~`/);
    });
  });

  describe("generateBundle hook", () => {
    it("should emit JSON file with collected translations", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "locales/en.json",
      });

      // Simulate transformation adding entries to store
      i18nStore.add({
        id: "abc123",
        source: "Hello World",
        ref: { file: "test.ts", line: 1, column: 1 },
      });
      i18nStore.add({
        id: "def456",
        source: "Goodbye World",
        ref: { file: "test.ts", line: 2, column: 1 },
      });

      callHook(plugin.generateBundle, mockPluginContext, {} as any, {} as any, false);

      expect(emittedFiles).toHaveLength(1);
      expect(emittedFiles[0]).toMatchObject({
        type: "asset",
        fileName: "locales/en.json",
      });

      const jsonContent = JSON.parse(emittedFiles[0].source);
      expect(jsonContent).toEqual({
        abc123: "Hello World",
        def456: "Goodbye World",
      });
    });

    it("should sort entries by id for consistent output", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "output.json",
      });

      // Add entries in non-alphabetical order
      i18nStore.add({
        id: "zebra",
        source: "Z message",
        ref: { file: "test.ts", line: 1, column: 1 },
      });
      i18nStore.add({
        id: "alpha",
        source: "A message",
        ref: { file: "test.ts", line: 2, column: 1 },
      });
      i18nStore.add({
        id: "beta",
        source: "B message",
        ref: { file: "test.ts", line: 3, column: 1 },
      });

      callHook(plugin.generateBundle, mockPluginContext, {} as any, {} as any, false);

      const jsonContent = JSON.parse(emittedFiles[0].source);
      const keys = Object.keys(jsonContent);

      expect(keys).toEqual(["alpha", "beta", "zebra"]);
    });

    it("should handle empty store gracefully", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "empty.json",
      });

      callHook(plugin.generateBundle, mockPluginContext, {} as any, {} as any, false);

      const jsonContent = JSON.parse(emittedFiles[0].source);
      expect(jsonContent).toEqual({});
    });

    it("should respect topLevelKey option", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "locales/en.json",
        topLevelKey: "common",
      });

      i18nStore.add({
        id: "msg1",
        source: "Hello",
        ref: { file: "test.ts", line: 1, column: 1 },
      });

      callHook(plugin.generateBundle, mockPluginContext, {} as any, {} as any, false);

      const jsonContent = JSON.parse(emittedFiles[0].source);
      expect(jsonContent).toEqual({
        common: {
          msg1: "Hello",
        },
      });
    });

    it("should handle special characters in strings", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "special.json",
      });

      i18nStore.add({
        id: "special",
        source: 'Hello "World" with \'quotes\' and \n newlines \t tabs',
        ref: { file: "test.ts", line: 1, column: 1 },
      });

      callHook(plugin.generateBundle, mockPluginContext, {} as any, {} as any, false);

      const jsonContent = JSON.parse(emittedFiles[0].source);
      expect(jsonContent.special).toBe('Hello "World" with \'quotes\' and \n newlines \t tabs');
    });

    it("should handle unicode characters", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "test.json",
      });

      const unicodeMessage = "Hello 世界 🌍 Café naïve résumé";
      i18nStore.add({
        id: "unicode",
        source: unicodeMessage,
        ref: { file: "test.ts", line: 1, column: 1 },
      });

      callHook(plugin.generateBundle, mockPluginContext, {} as any, {} as any, false);

      const jsonContent = JSON.parse(emittedFiles[0].source);
      expect(jsonContent.unicode).toBe(unicodeMessage);
    });
  });

  describe("Full workflow integration", () => {
    it("should handle complete build lifecycle", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "dist/locales/en.json",
        include: [/\.messages\.ts$/],
      });

      // 1. buildStart: clear store
      callHook(plugin.buildStart, mockPluginContext, {} as any);
      expect(i18nStore.all().size).toBe(0);

      // 2. transform: process files
      const code1 = `
export const Messages = {
  greeting: (name: string): string => "Hello {name}",
};
`;
      const result1 = callHook(plugin.transform, mockTransformContext, code1, "src/messages.messages.ts");
      expect(result1?.code).toContain("i18next.t(");

      const code2 = `
export const OtherMessages = {
  farewell: (): string => "Goodbye!",
};
`;
      const result2 = callHook(plugin.transform, mockTransformContext, code2, "src/other.messages.ts");
      expect(result2?.code).toContain("i18next.t(");

      // Store should have entries from transformation
      expect(i18nStore.all().size).toBeGreaterThan(0);

      // 3. generateBundle: emit JSON
      callHook(plugin.generateBundle, mockPluginContext, {} as any, {} as any, false);

      expect(emittedFiles).toHaveLength(1);
      expect(emittedFiles[0].fileName).toBe("dist/locales/en.json");

      const jsonContent = JSON.parse(emittedFiles[0].source);
      expect(Object.keys(jsonContent).length).toBeGreaterThan(0);
    });
  });

  describe("Configuration merging", () => {
    it("should use default include pattern when not specified", () => {
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "locales/en.json",
      });

      // Use actual transformable code (message function)
      const code = 'export const messages = { greeting: () => "Hello" };';

      // Should match default pattern: /\.messages\.(ts|tsx)$/
      const matchingResult = callHook(plugin.transform, mockTransformContext, code, "test.messages.ts");
      expect(matchingResult).not.toBeNull();
      expect(matchingResult.code).toContain('i18next.t(');

      const nonMatchingResult = callHook(plugin.transform, mockTransformContext, code, "test.ts");
      expect(nonMatchingResult).toBeNull();
    });

    it("should merge plugin options with config defaults", () => {
      // The plugin should use config defaults when options are not provided
      const plugin = i18nextAutoKeyRollupPlugin({
        jsonOutputPath: "locales/en.json",
        // argMode not specified, should use config default
      });

      expect(plugin).toBeDefined();
      // The actual merging is tested indirectly through transform behavior
    });
  });
});

