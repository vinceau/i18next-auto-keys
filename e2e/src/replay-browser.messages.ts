// Replay browser messages with ICU formatting (named parameters)
export const ReplayBrowserMessages = {
  // File count messages with pluralization
  totalFileCount: (count: number) => "{count, plural, one {# file} other {# files}} found.",
  
  hiddenFileCount: (count: number) => "{count, plural, one {# file} other {# files}} filtered.",
  
  errorFileCount: (count: number) => "{count, plural, one {# file} other {# files}} had errors.",

  // Simple ICU interpolation
  totalSize: (readableBytes: string) => "Total size: {readableBytes}",

  // Multiple parameters with ICU formatting
  processingStatus: (completed: number, total: number) => 
    "Processing: {completed, number} of {total, number} files",

  // Date/time formatting
  lastUpdated: (timestamp: string) => "Last updated: {timestamp, date, short}",

  // Number formatting with options
  downloadProgress: (percent: number) => "Download: {percent, number, percent}",

  // Complex pluralization with multiple conditions
  searchResults: (fileCount: number, matchCount: number) => 
    "{fileCount, plural, one {# file} other {# files}} with {matchCount, plural, one {# match} other {# matches}}",

  // Select formatting for conditional text
  connectionStatus: (status: string) => 
    "{status, select, online {Connected to server} offline {Connection lost} other {Unknown status}}",

  // Mixed ICU and regular text
  fileAnalysis: (fileName: string, size: number, errors: number) =>
    "File \"{fileName}\" ({size, number, bytes}) has {errors, plural, one {# error} other {# errors}}",
};
