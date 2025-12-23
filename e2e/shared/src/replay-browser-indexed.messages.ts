// Replay browser messages with ICU formatting (indexed parameters)
export const ReplayBrowserMessages = {
  // File count messages with pluralization (using {0} instead of {count})
  totalFileCount: (count: number) => "{0, plural, one {# file} other {# files}} found.",

  hiddenFileCount: (count: number) => "{0, plural, one {# file} other {# files}} filtered.",

  errorFileCount: (count: number) => "{0, plural, one {# file} other {# files}} had errors.",

  // Simple ICU interpolation (using {0} instead of {readableBytes})
  totalSize: (readableBytes: string) => "Total size: {0}",

  // Multiple parameters with ICU formatting (using {0}, {1} instead of {completed}, {total})
  processingStatus: (completed: number, total: number) => "Processing: {0, number} of {1, number} files",

  // Date/time formatting (using {0} instead of {timestamp})
  lastUpdated: (timestamp: string) => "Last updated: {0, date, short}",

  // Number formatting with options (using {0} instead of {percent})
  downloadProgress: (percent: number) => "Download: {0, number, percent}",

  // Complex pluralization with multiple conditions (using {0}, {1} instead of {fileCount}, {matchCount})
  searchResults: (fileCount: number, matchCount: number) =>
    "{0, plural, one {# file} other {# files}} with {1, plural, one {# match} other {# matches}}",

  // Select formatting for conditional text (using {0} instead of {status})
  connectionStatus: (status: string) =>
    "{0, select, online {Connected to server} offline {Connection lost} other {Unknown status}}",

  // Mixed ICU and regular text (using {0}, {1}, {2} instead of {fileName}, {size}, {errors})
  fileAnalysis: (fileName: string, size: number, errors: number) =>
    'File "{0}" ({1, number, bytes}) has {2, plural, one {# error} other {# errors}}',
};
