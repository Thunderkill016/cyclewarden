import {
  createDictionary,
  type DeepStringRecord,
  type Locale,
} from "@cyclewarden/i18n";
import en from "@cyclewarden/i18n/locales/forge/en.json";
import vi from "@cyclewarden/i18n/locales/forge/vi.json";

const forgeDictionaries: Record<Locale, DeepStringRecord> = { en, vi };

export function parseForgeLocale(value: unknown): Locale {
  return value === "en" ? "en" : "vi";
}

export function createForgeTranslator(locale: Locale) {
  return createDictionary(locale, forgeDictionaries);
}
