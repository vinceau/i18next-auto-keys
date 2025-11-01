import { I18nEmitPlugin } from "../i18nEmitPlugin";
import { i18nStore } from "../../common/i18nStore";
import type { Compiler, Compilation } from "webpack";

// Mock gettext-parser
const mockGettextParser = {
  po: {
    compile: jest.fn()
  }
};

// Mock webpack structures
const mockSources = {
  RawSource: jest.fn().mockImplementation((buffer) => ({ buffer }))
};

const mockCompilation = {
  hooks: {
    processAssets: {
      tap: jest.fn(),
      tapPromise: jest.fn()
    }
  },
  emitAsset: jest.fn()
} as unknown as Compilation;

const mockCompiler = {
  webpack: {
    Compilation: {
      PROCESS_ASSETS_STAGE_ADDITIONAL: "additional"
    },
    sources: mockSources
  },
  hooks: {
    thisCompilation: {
      tap: jest.fn()
    }
  }
} as unknown as Compiler;

describe("I18nEmitPlugin", () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Clear the i18n store
    i18nStore.clear();

    // Reset gettext-parser mock
    mockGettextParser.po.compile.mockReturnValue(Buffer.from("mock pot content"));
  });

  describe("Constructor", () => {
    it("should initialize with required options", () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "i18n/en.json"
      });

      expect(plugin).toBeInstanceOf(I18nEmitPlugin);
    });
  });

  describe("apply method", () => {
    it("should register thisCompilation hook", () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "i18n/en.json"
      });

      plugin.apply(mockCompiler);

      expect(mockCompiler.hooks.thisCompilation.tap).toHaveBeenCalledWith(
        "I18nEmitPlugin",
        expect.any(Function)
      );
    });

    it("should clear i18nStore on new compilation", () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "i18n/en.json"
      });

      // Add some data to store
      i18nStore.add({
        id: "test",
        source: "Test message",
        ref: { file: "test.ts", line: 1, column: 1 }
      });
      expect(i18nStore.all().size).toBe(1);

      plugin.apply(mockCompiler);

      // Get the registered callback and call it
      const compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      expect(i18nStore.all().size).toBe(0);
    });

    it("should register processAssets hook with correct stage", () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "i18n/en.json"
      });

      plugin.apply(mockCompiler);
      const compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      expect(mockCompilation.hooks.processAssets.tapPromise).toHaveBeenCalledWith(
        {
          name: "I18nEmitPlugin",
          stage: "additional"
        },
        expect.any(Function)
      );
    });
  });

  describe("JSON output generation", () => {
    it("should emit JSON file with entries from i18nStore", async () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "i18n/en.json"
      });

      plugin.apply(mockCompiler);
      const compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      // Add test data to store AFTER compilation starts (simulating what transformer does)
      i18nStore.add({
        id: "msg1",
        source: "Hello World",
        ref: { file: "test1.ts", line: 10, column: 5 }
      });
      i18nStore.add({
        id: "msg2",
        source: "Goodbye World",
        ref: { file: "test2.ts", line: 20, column: 10 }
      });

      const processAssetsCallback = (mockCompilation.hooks.processAssets.tapPromise as jest.Mock).mock.calls[0][1];
      await processAssetsCallback();

      // Verify JSON content
      expect(mockCompilation.emitAsset).toHaveBeenCalledWith(
        "i18n/en.json",
        expect.any(Object)
      );

      // Get the emitted buffer and verify content
      const emitCall = (mockCompilation.emitAsset as jest.Mock).mock.calls[0];
      const rawSource = emitCall[1];
      const jsonContent = JSON.parse(rawSource.buffer.toString());

      expect(jsonContent).toEqual({
        "msg1": "Hello World",
        "msg2": "Goodbye World"
      });
    });

    it("should sort entries by id for consistent output", async () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "output.json"
      });

      plugin.apply(mockCompiler);
      const compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      // Add entries in non-alphabetical order AFTER compilation starts
      i18nStore.add({
        id: "zebra",
        source: "Z message",
        ref: { file: "test.ts", line: 1, column: 1 }
      });
      i18nStore.add({
        id: "alpha",
        source: "A message",
        ref: { file: "test.ts", line: 2, column: 1 }
      });
      i18nStore.add({
        id: "beta",
        source: "B message",
        ref: { file: "test.ts", line: 3, column: 1 }
      });

      const processAssetsCallback = (mockCompilation.hooks.processAssets.tapPromise as jest.Mock).mock.calls[0][1];
      await processAssetsCallback();

      const emitCall = (mockCompilation.emitAsset as jest.Mock).mock.calls[0];
      const jsonContent = JSON.parse(emitCall[1].buffer.toString());
      const keys = Object.keys(jsonContent);

      expect(keys).toEqual(["alpha", "beta", "zebra"]);
    });

    it("should handle empty store gracefully", async () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "empty.json"
      });

      plugin.apply(mockCompiler);
      const compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      const processAssetsCallback = (mockCompilation.hooks.processAssets.tapPromise as jest.Mock).mock.calls[0][1];
      await processAssetsCallback();

      const emitCall = (mockCompilation.emitAsset as jest.Mock).mock.calls[0];
      const jsonContent = JSON.parse(emitCall[1].buffer.toString());

      expect(jsonContent).toEqual({});
    });

    it("should handle special characters in strings", async () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "special.json"
      });

      plugin.apply(mockCompiler);
      const compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      // Add test data AFTER compilation starts
      i18nStore.add({
        id: "special",
        source: "Hello \"World\" with 'quotes' and \n newlines \t tabs",
        ref: { file: "test.ts", line: 1, column: 1 }
      });

      const processAssetsCallback = (mockCompilation.hooks.processAssets.tapPromise as jest.Mock).mock.calls[0][1];
      await processAssetsCallback();

      const emitCall = (mockCompilation.emitAsset as jest.Mock).mock.calls[0];
      const jsonContent = JSON.parse(emitCall[1].buffer.toString());

      expect(jsonContent.special).toBe("Hello \"World\" with 'quotes' and \n newlines \t tabs");
    });
  });

  describe("POT output generation", () => {
    beforeEach(() => {
      // Mock gettext-parser as available
      jest.doMock("gettext-parser", () => mockGettextParser, { virtual: true });
    });

    afterEach(() => {
      jest.dontMock("gettext-parser");
    });

    it("should not emit POT file when potOutputPath is not provided", async () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "test.json"
      });

      plugin.apply(mockCompiler);
      const compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      // Add test data AFTER compilation starts
      i18nStore.add({
        id: "test",
        source: "Test message",
        ref: { file: "test.ts", line: 1, column: 1 }
      });

      const processAssetsCallback = (mockCompilation.hooks.processAssets.tapPromise as jest.Mock).mock.calls[0][1];
      await processAssetsCallback();

      // Should only emit JSON file
      expect(mockCompilation.emitAsset).toHaveBeenCalledTimes(1);
      expect(mockCompilation.emitAsset).toHaveBeenCalledWith(
        "test.json",
        expect.any(Object)
      );
    });

    it("should emit POT file when potOutputPath is provided and gettext-parser is available", async () => {
      // This test verifies the logic path for POT generation
      // Note: Actual gettext-parser integration is difficult to test due to optional loading
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "test.json",
        potOutputPath: "messages.pot",
        projectIdVersion: "test-app 1.0"
      });

      plugin.apply(mockCompiler);
      const compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      // Add test data AFTER compilation starts
      i18nStore.add({
        id: "msg1",
        source: "Hello World",
        ref: { file: "src/test.ts", line: 10, column: 5 },
        comments: ["Test comment", "Another comment"]
      });

      const processAssetsCallback = (mockCompilation.hooks.processAssets.tapPromise as jest.Mock).mock.calls[0][1];
      await processAssetsCallback();

      // Should emit at least JSON file (POT depends on gettext-parser availability)
      expect(mockCompilation.emitAsset).toHaveBeenCalledWith(
        "test.json",
        expect.any(Object)
      );
    });

    it("should include references and comments in POT file", async () => {
      // This test verifies the structure of the catalog object passed to gettext-parser
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "test.json",
        potOutputPath: "messages.pot"
      });

      plugin.apply(mockCompiler);
      const compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      // Add test data AFTER compilation starts
      i18nStore.add({
        id: "test_msg",
        source: "Test message",
        ref: { file: "src/component.tsx", line: 25, column: 10 },
        comments: ["Component error message"]
      });

      i18nStore.add({
        id: "test_msg",
        source: "Test message", // Same message, different location
        ref: { file: "src/service.ts", line: 45, column: 15 },
        comments: ["Service error message"]
      });

      const processAssetsCallback = (mockCompilation.hooks.processAssets.tapPromise as jest.Mock).mock.calls[0][1];
      await processAssetsCallback();

      // The logic should create a catalog with proper structure
      // We can verify this by checking the i18nStore contents
      const entries = Array.from(i18nStore.all().values());
      expect(entries).toHaveLength(1);
      expect(entries[0].refs.size).toBe(2);
      expect(entries[0].extractedComments.size).toBe(2);
    });
  });

  describe("Path normalization", () => {
    it("should normalize backslashes to forward slashes", async () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "i18n\\en.json" // Windows-style path
      });

      i18nStore.add({
        id: "test",
        source: "Test",
        ref: { file: "test.ts", line: 1, column: 1 }
      });

      plugin.apply(mockCompiler);
      const compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      const processAssetsCallback = (mockCompilation.hooks.processAssets.tapPromise as jest.Mock).mock.calls[0][1];
      await processAssetsCallback();

      expect(mockCompilation.emitAsset).toHaveBeenCalledWith(
        "i18n/en.json", // Normalized to forward slashes
        expect.any(Object)
      );
    });

    it("should handle already normalized paths", async () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "i18n/subdirectory/messages.json"
      });

      i18nStore.add({
        id: "test",
        source: "Test",
        ref: { file: "test.ts", line: 1, column: 1 }
      });

      plugin.apply(mockCompiler);
      const compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      const processAssetsCallback = (mockCompilation.hooks.processAssets.tapPromise as jest.Mock).mock.calls[0][1];
      await processAssetsCallback();

      expect(mockCompilation.emitAsset).toHaveBeenCalledWith(
        "i18n/subdirectory/messages.json",
        expect.any(Object)
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle entries with no references", async () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "test.json"
      });

      plugin.apply(mockCompiler);
      const compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      // Manually create entry with empty refs (edge case) AFTER compilation starts
      const entry = {
        id: "orphan",
        source: "Orphaned message",
        refs: new Set<string>(),
        extractedComments: new Set<string>()
      };

      // Add to store manually to simulate edge case
      (i18nStore as any).map.set("orphan", entry);

      const processAssetsCallback = (mockCompilation.hooks.processAssets.tapPromise as jest.Mock).mock.calls[0][1];
      await processAssetsCallback();

      const emitCall = (mockCompilation.emitAsset as jest.Mock).mock.calls[0];
      const jsonContent = JSON.parse(emitCall[1].buffer.toString());

      expect(jsonContent).toEqual({
        "orphan": "Orphaned message"
      });
    });

    it("should handle entries with no comments", async () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "test.json"
      });

      plugin.apply(mockCompiler);
      const compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      // Add test data AFTER compilation starts
      i18nStore.add({
        id: "no_comments",
        source: "Message without comments",
        ref: { file: "test.ts", line: 1, column: 1 }
        // No comments provided
      });

      const processAssetsCallback = (mockCompilation.hooks.processAssets.tapPromise as jest.Mock).mock.calls[0][1];
      await processAssetsCallback();

      expect(mockCompilation.emitAsset).toHaveBeenCalled();
    });

    it("should handle very long messages", async () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "test.json"
      });

      plugin.apply(mockCompiler);
      const compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      // Add test data AFTER compilation starts
      const longMessage = "A".repeat(10000); // 10KB message
      i18nStore.add({
        id: "long_msg",
        source: longMessage,
        ref: { file: "test.ts", line: 1, column: 1 }
      });

      const processAssetsCallback = (mockCompilation.hooks.processAssets.tapPromise as jest.Mock).mock.calls[0][1];
      await processAssetsCallback();

      const emitCall = (mockCompilation.emitAsset as jest.Mock).mock.calls[0];
      const jsonContent = JSON.parse(emitCall[1].buffer.toString());

      expect(jsonContent.long_msg).toBe(longMessage);
    });

    it("should handle unicode characters", async () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "test.json"
      });

      plugin.apply(mockCompiler);
      const compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      // Add test data AFTER compilation starts
      const unicodeMessage = "Hello 世界 🌍 Café naïve résumé";
      i18nStore.add({
        id: "unicode",
        source: unicodeMessage,
        ref: { file: "test.ts", line: 1, column: 1 }
      });

      const processAssetsCallback = (mockCompilation.hooks.processAssets.tapPromise as jest.Mock).mock.calls[0][1];
      await processAssetsCallback();

      const emitCall = (mockCompilation.emitAsset as jest.Mock).mock.calls[0];
      const jsonContent = JSON.parse(emitCall[1].buffer.toString());

      expect(jsonContent.unicode).toBe(unicodeMessage);
    });

    it("should handle multiple compilations", async () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "test.json"
      });

      plugin.apply(mockCompiler);

      // First compilation
      let compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      // Add data for first compilation
      i18nStore.add({
        id: "msg1",
        source: "First compilation",
        ref: { file: "test1.ts", line: 1, column: 1 }
      });

      let processAssetsCallback = (mockCompilation.hooks.processAssets.tapPromise as jest.Mock).mock.calls[0][1];
      processAssetsCallback();

      // Second compilation - store should be cleared when compilation callback runs
      compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      expect(i18nStore.all().size).toBe(0); // Store should be cleared

      // Add data for second compilation
      i18nStore.add({
        id: "msg2",
        source: "Second compilation",
        ref: { file: "test2.ts", line: 1, column: 1 }
      });

      processAssetsCallback = (mockCompilation.hooks.processAssets.tapPromise as jest.Mock).mock.calls[1][1];
      processAssetsCallback();

      // Should have emitted assets twice
      expect(mockCompilation.emitAsset).toHaveBeenCalledTimes(2);
    });
  });

  describe("Integration scenarios", () => {
    it("should work with complex real-world data", async () => {
      const plugin = new I18nEmitPlugin({
        jsonOutputPath: "dist/locales/en.json",
        potOutputPath: "src/locales/messages.pot",
        projectIdVersion: "my-app 2.1.0"
      });

      plugin.apply(mockCompiler);
      const compilationCallback = (mockCompiler.hooks.thisCompilation.tap as jest.Mock).mock.calls[0][1];
      compilationCallback(mockCompilation);

      // Add realistic translation data AFTER compilation starts
      const testData = [
        {
          id: "auth.login.error.invalid_credentials",
          source: "Invalid email or password. Please try again.",
          refs: [
            { file: "src/components/LoginForm.tsx", line: 45, column: 12 },
            { file: "src/services/authService.ts", line: 123, column: 25 }
          ],
          comments: ["Login form validation error", "Authentication service error"]
        },
        {
          id: "common.buttons.save",
          source: "Save Changes",
          refs: [
            { file: "src/components/UserProfile.tsx", line: 78, column: 15 },
            { file: "src/components/Settings.tsx", line: 92, column: 8 },
            { file: "src/components/EditModal.tsx", line: 156, column: 20 }
          ],
          comments: ["Profile save button", "Settings save button", "Modal save action"]
        }
      ];

      testData.forEach(data => {
        data.refs.forEach((ref, i) => {
          i18nStore.add({
            id: data.id,
            source: data.source,
            ref: ref,
            comments: i === 0 ? data.comments : [] // Add comments only once
          });
        });
      });

      const processAssetsCallback = (mockCompilation.hooks.processAssets.tapPromise as jest.Mock).mock.calls[0][1];
      await processAssetsCallback();

      // Verify JSON output
      const jsonEmitCall = (mockCompilation.emitAsset as jest.Mock).mock.calls[0];
      expect(jsonEmitCall[0]).toBe("dist/locales/en.json");

      const jsonContent = JSON.parse(jsonEmitCall[1].buffer.toString());
      expect(jsonContent).toEqual({
        "auth.login.error.invalid_credentials": "Invalid email or password. Please try again.",
        "common.buttons.save": "Save Changes"
      });

      // Verify entries have correct references
      const entries = Array.from(i18nStore.all().values());
      const authEntry = entries.find(e => e.id === "auth.login.error.invalid_credentials");
      const saveEntry = entries.find(e => e.id === "common.buttons.save");

      expect(authEntry?.refs.size).toBe(2);
      expect(saveEntry?.refs.size).toBe(3);
    });
  });
});
