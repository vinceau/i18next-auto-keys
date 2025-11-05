// Main entry point for e2e testing
import i18next from "i18next";
import ICU from "i18next-icu";

/**
 * Initialize i18next with the generated translations
 * This must be called after webpack has generated the translation files
 */
export async function initI18next(translations: any, useICU: boolean = false): Promise<void> {
  const config = {
    lng: "en",
    fallbackLng: "en",
    resources: {
      en: {
        translation: translations,
      },
    },
  };

  // Initialize i18next
  if (useICU) {
    await i18next.use(ICU).init(config);
  } else {
    await i18next.init(config);
  }
}
