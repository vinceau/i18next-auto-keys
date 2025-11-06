import { i18nStore, Entry } from "../i18nStore";

describe("i18nStore", () => {
  beforeEach(() => {
    i18nStore.clear();
  });

  it("should store entries with translation context", () => {
    i18nStore.add({
      id: "test-hash-1",
      source: "Welcome",
      translationContext: "authentication",
      ref: { file: "test.ts", line: 10, column: 5 },
      comments: ["Welcome message for login page"],
    });

    const entries = Array.from(i18nStore.all().values());
    expect(entries).toHaveLength(1);

    const entry = entries[0];
    expect(entry.id).toBe("test-hash-1");
    expect(entry.source).toBe("Welcome");
    expect(entry.translationContext).toBe("authentication");
    expect(entry.refs.has("test.ts:10:5")).toBe(true);
    expect(entry.extractedComments.has("Welcome message for login page")).toBe(true);
  });

  it("should store entries without translation context", () => {
    i18nStore.add({
      id: "test-hash-2",
      source: "Simple message",
      ref: { file: "simple.ts", line: 1, column: 1 },
      comments: ["No context needed"],
    });

    const entries = Array.from(i18nStore.all().values());
    expect(entries).toHaveLength(1);

    const entry = entries[0];
    expect(entry.id).toBe("test-hash-2");
    expect(entry.source).toBe("Simple message");
    expect(entry.translationContext).toBeUndefined();
  });

  it("should merge entries with same ID", () => {
    // Add first entry
    i18nStore.add({
      id: "same-hash",
      source: "Original message",
      translationContext: "context-1",
      ref: { file: "file1.ts", line: 10, column: 5 },
      comments: ["First comment"],
    });

    // Add second entry with same ID
    i18nStore.add({
      id: "same-hash",
      source: "Updated message",
      translationContext: "context-2",
      ref: { file: "file2.ts", line: 20, column: 10 },
      comments: ["Second comment"],
    });

    const entries = Array.from(i18nStore.all().values());
    expect(entries).toHaveLength(1);

    const entry = entries[0];
    expect(entry.id).toBe("same-hash");
    expect(entry.source).toBe("Updated message"); // Latest source
    expect(entry.translationContext).toBe("context-2"); // Latest context

    // Should have both references
    expect(entry.refs.has("file1.ts:10:5")).toBe(true);
    expect(entry.refs.has("file2.ts:20:10")).toBe(true);
    expect(entry.refs.size).toBe(2);

    // Should have both comments
    expect(entry.extractedComments.has("First comment")).toBe(true);
    expect(entry.extractedComments.has("Second comment")).toBe(true);
    expect(entry.extractedComments.size).toBe(2);
  });

  it("should handle translation context updates", () => {
    // Add entry without context
    i18nStore.add({
      id: "context-update",
      source: "Message",
      ref: { file: "test.ts", line: 1, column: 1 },
    });

    let entry = Array.from(i18nStore.all().values())[0];
    expect(entry.translationContext).toBeUndefined();

    // Update with context
    i18nStore.add({
      id: "context-update",
      source: "Message",
      translationContext: "added-context",
      ref: { file: "test.ts", line: 2, column: 1 },
    });

    entry = Array.from(i18nStore.all().values())[0];
    expect(entry.translationContext).toBe("added-context");

    // Update context again
    i18nStore.add({
      id: "context-update",
      source: "Message",
      translationContext: "updated-context",
      ref: { file: "test.ts", line: 3, column: 1 },
    });

    entry = Array.from(i18nStore.all().values())[0];
    expect(entry.translationContext).toBe("updated-context");
  });

  it("should handle parameter metadata with translation context", () => {
    i18nStore.add({
      id: "param-test",
      source: "Welcome {name}!",
      translationContext: "greetings",
      ref: { file: "greet.ts", line: 5, column: 10 },
      parameterMetadata: {
        parameterNames: ["name"],
        parameterTypes: ["string"],
        parameterJSDoc: { name: "User's display name" },
      },
    });

    const entry = Array.from(i18nStore.all().values())[0];
    expect(entry.translationContext).toBe("greetings");
    expect(entry.parameterMetadata).toBeDefined();
    expect(entry.parameterMetadata!.parameterNames).toEqual(["name"]);
    expect(entry.parameterMetadata!.parameterJSDoc.name).toBe("User's display name");
  });

  it("should demonstrate real-world scenario with context disambiguation", () => {
    // Same English text in different contexts
    const scenarios = [
      {
        id: "close-button-hash",
        source: "Close",
        context: "button",
        file: "button.ts",
      },
      {
        id: "close-dialog-hash",
        source: "Close",
        context: "dialog",
        file: "dialog.ts",
      },
      {
        id: "close-file-hash",
        source: "Close",
        context: "file-menu",
        file: "menu.ts",
      },
    ];

    // Add all entries
    scenarios.forEach((scenario, index) => {
      i18nStore.add({
        id: scenario.id,
        source: scenario.source,
        translationContext: scenario.context,
        ref: { file: scenario.file, line: 10 + index, column: 5 },
        comments: [`${scenario.context} context for close action`],
      });
    });

    const entries = Array.from(i18nStore.all().values());
    expect(entries).toHaveLength(3);

    // Each should have different ID and context despite same source
    const contexts = entries.map((e) => e.translationContext);
    expect(contexts).toEqual(expect.arrayContaining(["button", "dialog", "file-menu"]));

    const sources = entries.map((e) => e.source);
    expect(sources.every((s) => s === "Close")).toBe(true);

    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(3); // All different IDs
  });

  it("should clear all entries", () => {
    i18nStore.add({
      id: "test-1",
      source: "Message 1",
      ref: { file: "test.ts", line: 1, column: 1 },
    });

    i18nStore.add({
      id: "test-2",
      source: "Message 2",
      translationContext: "context",
      ref: { file: "test.ts", line: 2, column: 1 },
    });

    expect(i18nStore.all().size).toBe(2);

    i18nStore.clear();

    expect(i18nStore.all().size).toBe(0);
  });
});
