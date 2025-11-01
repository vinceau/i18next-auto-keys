import { stringPool } from "../stringPool";

describe("StringPool", () => {
  beforeEach(() => {
    stringPool.clear();
  });

  it("interns strings to avoid duplication", () => {
    const str1 = "This is a long translation string that would normally be duplicated across multiple stores";
    const str2 = "This is a long translation string that would normally be duplicated across multiple stores"; // Same content
    const str3 = "Different string";

    const interned1 = stringPool.intern(str1);
    const interned2 = stringPool.intern(str2);
    const interned3 = stringPool.intern(str3);

    // Same content should return the exact same object reference
    expect(interned1).toBe(interned2); // Same reference in memory
    expect(interned1).not.toBe(interned3);

    // Content should still be correct
    expect(interned1).toEqual(str1);
    expect(interned3).toEqual(str3);
  });

  it("provides memory usage statistics", () => {
    const longString1 = "A".repeat(500); // 500 chars
    const longString2 = "B".repeat(300); // 300 chars
    const duplicateString = "A".repeat(500); // Same as longString1

    stringPool.intern(longString1);
    stringPool.intern(longString2);
    stringPool.intern(duplicateString); // Should not increase count

    const stats = stringPool.getStats();
    expect(stats.uniqueStrings).toBe(2); // Only 2 unique strings
    expect(stats.totalCharacters).toBe(800); // 500 + 300, not 1300
  });

  it("demonstrates memory savings in realistic scenario", () => {
    // Simulate a realistic translation project
    const messages = [
      "Unable to connect to the authentication server. Please check your internet connection and try again.",
      "Your password must be at least 8 characters long and contain both uppercase and lowercase letters.",
      "The file you are trying to upload exceeds the maximum size limit of 10MB. Please choose a smaller file.",
      "Unable to connect to the authentication server. Please check your internet connection and try again.", // Duplicate
      "Session expired. Please log in again to continue using the application.",
      "The file you are trying to upload exceeds the maximum size limit of 10MB. Please choose a smaller file.", // Duplicate
    ];

    // Intern all strings (simulating what our stores would do)
    const internedMessages = messages.map(msg => stringPool.intern(msg));

    const stats = stringPool.getStats();

    // Should only store unique strings
    expect(stats.uniqueStrings).toBe(4); // 4 unique messages despite 6 total

    // Check that duplicates return same reference
    expect(internedMessages[0]).toBe(internedMessages[3]); // Same auth error
    expect(internedMessages[2]).toBe(internedMessages[5]); // Same file size error

    // Memory saving calculation
    const totalChars = messages.reduce((sum, msg) => sum + msg.length, 0);
    const uniqueChars = stats.totalCharacters;
    const savings = totalChars - uniqueChars;

    expect(savings).toBeGreaterThan(0);
    console.log(`Memory savings: ${savings} characters (${Math.round(savings/totalChars*100)}%)`);
  });

  it("works correctly with empty strings and special characters", () => {
    const emptyString = "";
    const unicodeString = "🚀 Hello 世界 Émoji";

    const interned1 = stringPool.intern(emptyString);
    const interned2 = stringPool.intern(emptyString);
    const interned3 = stringPool.intern(unicodeString);
    const interned4 = stringPool.intern(unicodeString);

    expect(interned1).toBe(interned2);
    expect(interned3).toBe(interned4);
    expect(interned1).not.toBe(interned3);

    expect(interned1).toEqual("");
    expect(interned3).toEqual("🚀 Hello 世界 Émoji");
  });
});
