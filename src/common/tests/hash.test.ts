import { stableHash } from "../hash";

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
      const hash6 = stableHash(text, { hashLength: 6 });
      const hash15 = stableHash(text, { hashLength: 15 });

      expect(hash6).toHaveLength(6);
      expect(hash15).toHaveLength(15);

      // Shorter hash should be prefix of longer one (same SHA1 source)
      expect(hash15.startsWith(hash6)).toBe(true);
    });

    it("enforces minimum hash length of 4", () => {
      const text = "Test";
      const hash = stableHash(text, { hashLength: 2 }); // Request 2, should get 4

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

    it("generates consistent hashes for same source and context", () => {
      const source = "Login";
      const context = "authentication";

      const hash1 = stableHash(source, { context });
      const hash2 = stableHash(source, { context });

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(10); // Default length
    });

    it("generates different hashes for same source with different contexts", () => {
      const source = "Settings";

      const hashAuth = stableHash(source, { context: "authentication" });
      const hashNav = stableHash(source, { context: "navigation" });
      const hashUser = stableHash(source, { context: "user-profile" });

      expect(hashAuth).not.toBe(hashNav);
      expect(hashAuth).not.toBe(hashUser);
      expect(hashNav).not.toBe(hashUser);
    });

    it("generates different hashes for different sources with same context", () => {
      const context = "authentication";

      const hashLogin = stableHash("Login", { context });
      const hashLogout = stableHash("Logout", { context });
      const hashSignup = stableHash("Sign Up", { context });

      expect(hashLogin).not.toBe(hashLogout);
      expect(hashLogin).not.toBe(hashSignup);
      expect(hashLogout).not.toBe(hashSignup);
    });

    it("handles undefined/null context gracefully", () => {
      const source = "Welcome message";

      const hashUndefined = stableHash(source, { context: undefined as any });
      const hashNull = stableHash(source, { context: null as any });
      const hashEmpty = stableHash(source, { context: "" });
      const hashNoContext = stableHash(source); // No context parameter

      // Undefined and null should behave the same as no context
      expect(hashUndefined).toBe(hashNoContext);
      expect(hashNull).toBe(hashNoContext);

      // Empty string should also behave the same as no context (since we check for length > 0)
      expect(hashEmpty).toBe(hashNoContext);
    });

    it("respects custom hash length with context", () => {
      const source = "Test message";
      const context = "test-context";

      const hash6 = stableHash(source, { context, hashLength: 6 });
      const hash15 = stableHash(source, { context, hashLength: 15 });

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

      const hashes = scenarios.map(({ source, context }) => stableHash(source, { context }));

      // All should be different
      expect(new Set(hashes).size).toBe(3);

      // But consistent when called again
      scenarios.forEach(({ source, context }, index) => {
        const repeatHash = stableHash(source, { context });
        expect(repeatHash).toBe(hashes[index]);
      });
    });

    it("handles special characters in context", () => {
      const source = "Message";

      const hashDash = stableHash(source, { context: "user-profile" });
      const hashUnderscore = stableHash(source, { context: "user_profile" });
      const hashDot = stableHash(source, { context: "user.profile" });
      const hashSlash = stableHash(source, { context: "user/profile" });

      // All should be different (different context strings)
      const allHashes = [hashDash, hashUnderscore, hashDot, hashSlash];
      expect(new Set(allHashes).size).toBe(4);
    });

    it("produces different results than concatenation-based approaches", () => {
      const source = "Test";
      const context = "context";

      // Our approach uses "::" separator internally
      const ourHash = stableHash(source, { context });

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

      const hash1 = stableHash("abc", { context: "def" });
      const hash2 = stableHash("ab", { context: "cdef" });
      const hash3 = stableHash("abcd", { context: "ef" });

      // These should all be different due to :: separator
      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash2).not.toBe(hash3);
    });

    describe("string normalization", () => {
      it("normalizes whitespace to reduce churn from harmless edits", () => {
        const text = "Hello   world";
        const textWithExtraSpaces = "Hello     world";
        const textWithTabs = "Hello\t\tworld";
        
        const hash1 = stableHash(text, { normalize: true });
        const hash2 = stableHash(textWithExtraSpaces, { normalize: true });
        const hash3 = stableHash(textWithTabs, { normalize: true });
        
        // All should produce the same hash when normalized
        expect(hash1).toBe(hash2);
        expect(hash1).toBe(hash3);
      });

      it("normalizes line endings to reduce platform differences", () => {
        const unixText = "Line 1\nLine 2";
        const windowsText = "Line 1\r\nLine 2";
        const mixedText = "Line 1\r\n\nLine 2";
        
        const hash1 = stableHash(unixText, { normalize: true });
        const hash2 = stableHash(windowsText, { normalize: true });
        const hash3 = stableHash(mixedText, { normalize: true });
        
        // Unix and Windows line endings should produce the same hash
        expect(hash1).toBe(hash2);
        // Mixed endings should normalize to consistent format
        expect(hash1).toBe(hash3);
      });

      it("normalizes ICU punctuation spacing", () => {
        const text1 = "Hello {name}, you have {count} messages";
        const text2 = "Hello { name }, you have { count } messages";
        const text3 = "Hello {  name  } , you have {  count  } messages";
        
        const hash1 = stableHash(text1, { normalize: true });
        const hash2 = stableHash(text2, { normalize: true });
        const hash3 = stableHash(text3, { normalize: true });
        
        // All should produce the same hash after ICU punctuation normalization
        expect(hash1).toBe(hash2);
        expect(hash1).toBe(hash3);
      });

      it("trims leading and trailing whitespace", () => {
        const text1 = "Hello world";
        const text2 = "  Hello world  ";
        const text3 = "\t\nHello world\n\t";
        
        const hash1 = stableHash(text1, { normalize: true });
        const hash2 = stableHash(text2, { normalize: true });
        const hash3 = stableHash(text3, { normalize: true });
        
        // All should produce the same hash after trimming
        expect(hash1).toBe(hash2);
        expect(hash1).toBe(hash3);
      });

      it("produces different hashes when normalization is disabled", () => {
        const text1 = "Hello world";
        const text2 = "Hello   world";
        
        const hashNormalized1 = stableHash(text1, { normalize: true });
        const hashNormalized2 = stableHash(text2, { normalize: true });
        const hashNotNormalized1 = stableHash(text1, { normalize: false });
        const hashNotNormalized2 = stableHash(text2, { normalize: false });
        
        // Normalized versions should be the same
        expect(hashNormalized1).toBe(hashNormalized2);
        
        // Non-normalized versions should be different
        expect(hashNotNormalized1).not.toBe(hashNotNormalized2);
        
        // Normalized vs non-normalized should be different for the spaced version
        expect(hashNormalized2).not.toBe(hashNotNormalized2);
      });

      it("defaults to normalization enabled when normalize option is not specified", () => {
        const text1 = "Hello world";
        const text2 = "Hello   world";
        
        // Default behavior (normalize should be true by default)
        const hashDefault1 = stableHash(text1);
        const hashDefault2 = stableHash(text2);
        
        // Explicit normalization enabled
        const hashExplicit1 = stableHash(text1, { normalize: true });
        const hashExplicit2 = stableHash(text2, { normalize: true });
        
        // Default should match explicit normalize: true
        expect(hashDefault1).toBe(hashExplicit1);
        expect(hashDefault2).toBe(hashExplicit2);
        
        // Both should be the same due to normalization
        expect(hashDefault1).toBe(hashDefault2);
      });

      it("works correctly with context and normalization", () => {
        const text1 = "Hello  world";
        const text2 = "Hello    world";
        const context = "greeting";
        
        const hash1 = stableHash(text1, { context, normalize: true });
        const hash2 = stableHash(text2, { context, normalize: true });
        
        // Should produce the same hash with context and normalization
        expect(hash1).toBe(hash2);
        
        // Should be different from the same text without context
        const hashNoContext = stableHash(text1, { normalize: true });
        expect(hash1).not.toBe(hashNoContext);
      });
    });
  });
});
