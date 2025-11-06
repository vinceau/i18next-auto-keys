import { stableHash, stableHashWithContext } from "../hash";

describe("Hash Functions", () => {
  describe("stableHash", () => {
    it("generates consistent hashes for same input", () => {
      const text = "Hello world";
      const hash1 = stableHash(text);
      const hash2 = stableHash(text);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(10); // Default length
    });

    it("generates different hashes for different inputs", () => {
      const hash1 = stableHash("Hello world");
      const hash2 = stableHash("Hello World"); // Different case
      const hash3 = stableHash("Goodbye world");

      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash2).not.toBe(hash3);
    });

    it("respects custom hash length", () => {
      const text = "Test string";
      const hash6 = stableHash(text, 6);
      const hash15 = stableHash(text, 15);

      expect(hash6).toHaveLength(6);
      expect(hash15).toHaveLength(15);

      // Shorter hash should be prefix of longer one (same SHA1 source)
      expect(hash15.startsWith(hash6)).toBe(true);
    });

    it("enforces minimum hash length of 4", () => {
      const text = "Test";
      const hash = stableHash(text, 2); // Request 2, should get 4

      expect(hash).toHaveLength(4);
    });

    it("handles empty strings", () => {
      const hash = stableHash("");

      expect(hash).toHaveLength(10);
      expect(hash).toMatch(/^[a-f0-9]+$/); // Only hex characters
    });

    it("handles unicode characters", () => {
      const hash1 = stableHash("Hello 世界");
      const hash2 = stableHash("Hello 🌍");

      expect(hash1).toHaveLength(10);
      expect(hash2).toHaveLength(10);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("stableHashWithContext", () => {
    it("generates consistent hashes for same source and context", () => {
      const source = "Login";
      const context = "authentication";

      const hash1 = stableHashWithContext(source, context);
      const hash2 = stableHashWithContext(source, context);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(10); // Default length
    });

    it("generates different hashes for same source with different contexts", () => {
      const source = "Settings";

      const hashAuth = stableHashWithContext(source, "authentication");
      const hashNav = stableHashWithContext(source, "navigation");
      const hashUser = stableHashWithContext(source, "user-profile");

      expect(hashAuth).not.toBe(hashNav);
      expect(hashAuth).not.toBe(hashUser);
      expect(hashNav).not.toBe(hashUser);
    });

    it("generates different hashes for different sources with same context", () => {
      const context = "authentication";

      const hashLogin = stableHashWithContext("Login", context);
      const hashLogout = stableHashWithContext("Logout", context);
      const hashSignup = stableHashWithContext("Sign Up", context);

      expect(hashLogin).not.toBe(hashLogout);
      expect(hashLogin).not.toBe(hashSignup);
      expect(hashLogout).not.toBe(hashSignup);
    });

    it("handles undefined/null context gracefully", () => {
      const source = "Welcome message";

      const hashUndefined = stableHashWithContext(source, undefined);
      const hashNull = stableHashWithContext(source, null as any);
      const hashEmpty = stableHashWithContext(source, "");
      const hashNoContext = stableHash(source); // Original function

      // Undefined and null should behave the same as no context
      expect(hashUndefined).toBe(hashNoContext);
      expect(hashNull).toBe(hashNoContext);

      // Empty string is a valid context, should be different
      expect(hashEmpty).not.toBe(hashNoContext);
    });

    it("respects custom hash length", () => {
      const source = "Test message";
      const context = "test-context";

      const hash6 = stableHashWithContext(source, context, 6);
      const hash15 = stableHashWithContext(source, context, 15);

      expect(hash6).toHaveLength(6);
      expect(hash15).toHaveLength(15);
    });

    it("demonstrates real-world disambiguation scenarios", () => {
      // Same English text in different contexts should get different hashes
      const scenarios = [
        { source: "Close", context: "dialog-button" },
        { source: "Close", context: "navigation-menu" },
        { source: "Close", context: "file-operation" },
      ];

      const hashes = scenarios.map(({ source, context }) => stableHashWithContext(source, context));

      // All should be different
      expect(new Set(hashes).size).toBe(3);

      // But consistent when called again
      scenarios.forEach(({ source, context }, index) => {
        const repeatHash = stableHashWithContext(source, context);
        expect(repeatHash).toBe(hashes[index]);
      });
    });

    it("handles special characters in context", () => {
      const source = "Message";

      const hashDash = stableHashWithContext(source, "user-profile");
      const hashUnderscore = stableHashWithContext(source, "user_profile");
      const hashDot = stableHashWithContext(source, "user.profile");
      const hashSlash = stableHashWithContext(source, "user/profile");

      // All should be different (different context strings)
      const allHashes = [hashDash, hashUnderscore, hashDot, hashSlash];
      expect(new Set(allHashes).size).toBe(4);
    });

    it("produces different results than concatenation-based approaches", () => {
      const source = "Test";
      const context = "context";

      // Our approach uses "::" separator internally
      const ourHash = stableHashWithContext(source, context);

      // Naive concatenation approaches
      const concatHash = stableHash(source + context);
      const spaceHash = stableHash(source + " " + context);
      const dashHash = stableHash(source + "-" + context);

      // Should be different from naive approaches
      expect(ourHash).not.toBe(concatHash);
      expect(ourHash).not.toBe(spaceHash);
      expect(ourHash).not.toBe(dashHash);
    });

    it("handles context collision edge cases", () => {
      // Test cases where naive concatenation might cause collisions
      // but our approach with "::" separator should not

      const hash1 = stableHashWithContext("abc", "def");
      const hash2 = stableHashWithContext("ab", "cdef");
      const hash3 = stableHashWithContext("abcd", "ef");

      // These should all be different due to :: separator
      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash2).not.toBe(hash3);
    });
  });
});
