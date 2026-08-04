import type { Locale } from "@cyclewarden/i18n";

export interface ForgeLanguageState {
  interfaceLocale: Locale;
  instructionLanguage: Locale;
  technicalOutputLanguage: Locale;
}

export const initialForgeLanguageState: ForgeLanguageState = {
  interfaceLocale: "vi",
  instructionLanguage: "vi",
  technicalOutputLanguage: "en",
};

export function switchForgeInterfaceLocale(
  state: ForgeLanguageState,
  interfaceLocale: Locale,
): ForgeLanguageState {
  return { ...state, interfaceLocale };
}
