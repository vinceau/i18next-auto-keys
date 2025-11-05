// Main entry point for e2e testing
import i18next from "i18next";

/**
 * Initialize i18next with the generated translations
 * This must be called after webpack has generated the translation files
 */
export async function initI18next(translations: any): Promise<void> {
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
}
