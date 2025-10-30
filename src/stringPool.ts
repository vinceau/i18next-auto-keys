/**
 * String interning pool to eliminate memory duplication.
 * Each unique string is stored exactly once, with all stores referencing the same instance.
 */
export class StringPool {
  private pool = new Map<string, string>();

  /**
   * Returns the canonical instance of a string.
   * If the string already exists, returns the existing instance.
   * Otherwise, stores and returns the new string.
   */
  intern(str: string): string {
    const existing = this.pool.get(str);
    if (existing !== undefined) {
      return existing; // Return existing canonical instance
    }
    // Store new string and return it
    this.pool.set(str, str);
    return str;
  }

  /**
   * Get memory usage statistics
   */
  getStats() {
    return {
      uniqueStrings: this.pool.size,
      totalCharacters: Array.from(this.pool.keys()).reduce((sum, str) => sum + str.length, 0),
    };
  }

  /**
   * Clear the pool (useful for testing)
   */
  clear() {
    this.pool.clear();
  }
}

// Global singleton
export const stringPool = new StringPool();
