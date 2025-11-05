// Main entry point for e2e testing
import * as fs from "fs";
import * as path from "path";
import { AuthMessages } from "./auth.messages";
import { UIMessages } from "./ui.messages";
import { initI18next } from "./i18next/init";

// Flag to track if i18next has been initialized
let isInitialized = false;

/**
 * Initialize i18next with the generated translations
 * This must be called after webpack has generated the translation files
 */
export async function initializeI18n(translationsDir: string): Promise<void> {
  if (isInitialized) return;

  const translationsPath = path.join(translationsDir, "en.json");
  let translations = {};

  // Load translations if they exist
  if (fs.existsSync(translationsPath)) {
    const translationsContent = fs.readFileSync(translationsPath, "utf8");
    translations = JSON.parse(translationsContent);
  }

  // Initialize i18next
  await initI18next(translations);

  isInitialized = true;
}

// Export all message modules for testing
export { AuthMessages, UIMessages };

// Example usage functions that will be tested
export function getWelcomeMessage(userName: string): string {
  return AuthMessages.welcome(userName);
}

export function getStatusMessage(count: number): string {
  return UIMessages.itemCount(count);
}

export function getResetEmailMessage(email: string, minutes: number): string {
  return AuthMessages.resetEmailSent(email, minutes);
}

// Test various message types
export function getAllSimpleMessages(): string[] {
  return [
    AuthMessages.title(),
    AuthMessages.loginButton(),
    UIMessages.homeTab(),
    UIMessages.saveButton(),
    UIMessages.loading(),
  ];
}

export function getComplexMessage(): string {
  return AuthMessages.attemptsRemaining(3, 5);
}

// This should remain unchanged due to @noTranslate
export function getDebugMessage(): string {
  return AuthMessages.debugInfo();
}
