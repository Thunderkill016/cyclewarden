import { createForgeTranslator } from "@/lib/forge/i18n";
import type { ForgeLanguageState } from "@/lib/forge/language-state";

export function TaskComposer({
  languages,
  onLanguagesChange,
}: {
  languages: ForgeLanguageState;
  onLanguagesChange: (next: ForgeLanguageState) => void;
}) {
  const t = createForgeTranslator(languages.interfaceLocale);

  return (
    <fieldset className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <legend className="px-2 text-sm font-semibold text-foreground">
        {t("task.legend")}
      </legend>
      <label className="block text-sm text-muted">
        {t("task.instructionLabel")}
        <textarea
          name="instruction"
          required
          minLength={10}
          maxLength={10_000}
          rows={7}
          placeholder={t("task.instructionPlaceholder")}
          className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed text-foreground outline-none transition-colors focus:border-accent"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-muted">
          {t("language.instruction")}
          <select
            name="instructionLanguage"
            value={languages.instructionLanguage}
            onChange={(event) =>
              onLanguagesChange({
                ...languages,
                instructionLanguage: event.target.value === "en" ? "en" : "vi",
              })
            }
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
          >
            <option value="vi">{t("language.vietnamese")}</option>
            <option value="en">{t("language.english")}</option>
          </select>
        </label>
        <label className="text-sm text-muted">
          {t("language.technicalOutput")}
          <select
            name="technicalOutputLanguage"
            value={languages.technicalOutputLanguage}
            onChange={(event) =>
              onLanguagesChange({
                ...languages,
                technicalOutputLanguage: event.target.value === "vi" ? "vi" : "en",
              })
            }
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
          >
            <option value="en">{t("language.english")}</option>
            <option value="vi">{t("language.vietnamese")}</option>
          </select>
        </label>
      </div>
    </fieldset>
  );
}
