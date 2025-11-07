// Shared mock implementation for loadGettextParser
// This provides a realistic gettext-parser mock that handles common PO file operations
// Individual tests can override specific methods if they need custom behavior

import type { PoApi } from "../loadGettextParser";

/**
 * Standard gettext-parser mock that provides:
 * - Generic PO file parsing (msgid/msgstr pairs with optional msgctxt)
 * - Simple compile mock (tests can override for specific behavior)
 * - Standard catalog structure with headers and translations
 */
export const createMockGettextParser = (): PoApi => ({
  po: {
    parse: jest.fn((buffer: string | Buffer) => {
      const content = typeof buffer === "string" ? buffer : buffer.toString();

      // Standard catalog structure
      const catalog = {
        charset: "utf-8",
        headers: {
          "project-id-version": "test-app 1.0",
          "mime-version": "1.0",
          "content-type": "text/plain; charset=UTF-8",
          "content-transfer-encoding": "8bit",
          "x-generator": "i18next-auto-keys CLI",
        } as any,
        translations: {
          "": {} as any, // Default context for entries without msgctxt
        } as any,
      };

      // Extract language from headers if available
      const languageMatch = content.match(/"Language:\s*([^\\]+)\\n"/);
      if (languageMatch) {
        catalog.headers.language = languageMatch[1];
      }

      // Extract PO-Revision-Date if available
      const revisionMatch = content.match(/"PO-Revision-Date:\s*([^\\]+)\\n"/);
      if (revisionMatch) {
        catalog.headers["po-revision-date"] = revisionMatch[1];
      }

      // Parse msgid/msgstr pairs with optional msgctxt
      // This regex handles: [msgctxt "context"] msgid "id" msgstr "translation"
      const msgEntryRegex = /(?:msgctxt\s+"([^"]+)"\s+)?msgid\s+"([^"]+)"\s+msgstr\s+"([^"]*)"/g;
      let match;

      while ((match = msgEntryRegex.exec(content)) !== null) {
        const [, msgctxt, msgid, msgstr] = match;

        // Skip empty msgid (header entry)
        if (!msgid || msgid === "") continue;

        const contextKey = msgctxt || "";

        // Ensure context exists
        if (!catalog.translations[contextKey]) {
          catalog.translations[contextKey] = {};
        }

        catalog.translations[contextKey][msgid] = {
          msgid,
          msgctxt: msgctxt || undefined,
          msgstr: [msgstr || ""],
          comments: {},
        };
      }

      return catalog;
    }),

    // Simple compile mock - tests that need specific behavior can override this
    compile: jest.fn(() => Buffer.from("mock compiled po content", "utf8")),

    // Add other required methods as no-ops for completeness
    createParseStream: jest.fn(),
    createWriteStream: jest.fn(),
  } as any,
});

// Default mock instance
const mockGettextParser = createMockGettextParser();

// Mock the loadGettextParser function
export const loadGettextParser = jest.fn(() => Promise.resolve(mockGettextParser));

// Export the mock instance for tests that need to access it directly
export { mockGettextParser };
