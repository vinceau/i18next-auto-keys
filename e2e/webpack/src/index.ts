// Main entry point for e2e testing
import fs from "fs";
import path from "path";
import { AuthMessages } from "./auth.messages";
import { UIMessages } from "./ui.messages";
import { ContextMessages } from "./context.messages";
import i18next from "i18next";

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
  await i18next.init({
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

// Export all message modules for testing
export { AuthMessages, UIMessages, ContextMessages };

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

// Context-specific message functions for testing translation context disambiguation
export function getCloseDialogMessage(): string {
  return ContextMessages.closeModal();
}

export function getCloseFileMessage(): string {
  return ContextMessages.closeFile();
}

export function getCloseNotificationMessage(): string {
  return ContextMessages.closeNotification();
}

export function getSaveDocumentMessage(): string {
  return ContextMessages.saveDocument();
}

export function getSaveProfileMessage(): string {
  return ContextMessages.saveProfile();
}

export function getSaveGameMessage(): string {
  return ContextMessages.saveGame();
}

export function getAccountSettingsMessage(): string {
  return ContextMessages.accountSettings();
}

export function getAppSettingsMessage(): string {
  return ContextMessages.appSettings();
}

export function getPrivacySettingsMessage(): string {
  return ContextMessages.privacySettings();
}

export function getAuthWelcomeMessage(name: string): string {
  return ContextMessages.welcomeUser(name);
}

export function getGuestWelcomeMessage(name: string): string {
  return ContextMessages.welcomeGuest(name);
}

export function getAdminNotificationMessage(count: number): string {
  return ContextMessages.adminNotification(count);
}

export function getUserNotificationMessage(count: number): string {
  return ContextMessages.userNotification(count);
}

export function getGenericErrorMessage(): string {
  return ContextMessages.genericError();
}

export function getConfirmActionMessage(): string {
  return ContextMessages.confirmAction();
}

export function getComplexFeatureHelpMessage(): string {
  return ContextMessages.complexFeatureHelp();
}
