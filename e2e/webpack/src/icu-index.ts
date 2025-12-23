// ICU testing entry point
import i18next from "i18next";
import ICU from "i18next-icu";
import fs from "fs";
import path from "path";
import { ReplayBrowserMessages } from "../../shared/src/replay-browser.messages";

// Flag to track if i18next has been initialized
let isInitialized = false;

/**
 * Initialize i18next with ICU support and generated translations
 * This must be called after webpack has generated the translation files
 */
export async function initializeI18n(translationsDir: string): Promise<void> {
  if (isInitialized) return;

  let translations = {};

  // Find the correct translation file in the directory
  // Look for any *-en.json file or fallback to en.json
  const files = fs.readdirSync(translationsDir);
  const translationFile = files.find((file) => file.endsWith("-en.json")) || "en.json";
  const translationsPath = path.join(translationsDir, translationFile);

  // Load translations if they exist
  if (fs.existsSync(translationsPath)) {
    const translationsContent = fs.readFileSync(translationsPath, "utf8");
    translations = JSON.parse(translationsContent);
  }

  // Initialize i18next with ICU plugin
  await i18next
    .use(ICU) // Enable ICU message formatting
    .init({
      lng: "en",
      fallbackLng: "en",
      resources: {
        en: {
          translation: translations,
        },
      },
    });

  isInitialized = true;
}

// Export all ICU message functions for testing
export function getTotalFileCount(count: number): string {
  return ReplayBrowserMessages.totalFileCount(count);
}

export function getHiddenFileCount(count: number): string {
  return ReplayBrowserMessages.hiddenFileCount(count);
}

export function getErrorFileCount(count: number): string {
  return ReplayBrowserMessages.errorFileCount(count);
}

export function getTotalSize(readableBytes: string): string {
  return ReplayBrowserMessages.totalSize(readableBytes);
}

export function getProcessingStatus(completed: number, total: number): string {
  return ReplayBrowserMessages.processingStatus(completed, total);
}

export function getLastUpdated(timestamp: string): string {
  return ReplayBrowserMessages.lastUpdated(timestamp);
}

export function getDownloadProgress(percent: number): string {
  return ReplayBrowserMessages.downloadProgress(percent);
}

export function getSearchResults(fileCount: number, matchCount: number): string {
  return ReplayBrowserMessages.searchResults(fileCount, matchCount);
}

export function getConnectionStatus(status: string): string {
  return ReplayBrowserMessages.connectionStatus(status);
}

export function getFileAnalysis(fileName: string, size: number, errors: number): string {
  return ReplayBrowserMessages.fileAnalysis(fileName, size, errors);
}
