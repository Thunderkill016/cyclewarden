import type { Locale } from "@cyclewarden/i18n";

import { createForgeTranslator } from "@/lib/forge/i18n";

export function RunReview({
  baseBranch = "main",
  locale,
}: {
  baseBranch?: string;
  locale: Locale;
}) {
  const t = createForgeTranslator(locale);

  return (
    <fieldset className="space-y-4 rounded-2xl border border-accent/50 bg-accent/5 p-5">
      <legend className="px-2 text-sm font-semibold text-accent">
        {t("review.legend")}
      </legend>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-muted">
          {t("review.baseBranch")}
          <input
            name="baseBranch"
            value={baseBranch}
            readOnly
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-foreground"
          />
        </label>
        <label className="text-muted">
          {t("review.agent")}
          <select
            name="agentProvider"
            defaultValue="codex"
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground"
          >
            <option value="codex">Codex</option>
          </select>
        </label>
        <label className="text-muted">
          {t("review.budget")}
          <input
            name="budgetUsd"
            type="number"
            min="0.1"
            max="100"
            step="0.1"
            defaultValue="2"
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
          />
        </label>
        <label className="text-muted">
          {t("review.networkPolicy")}
          <select
            name="networkPolicy"
            defaultValue="deny-by-default"
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground"
          >
            <option value="deny-by-default">{t("review.denyByDefault")}</option>
            <option value="package-registries">{t("review.registriesOnly")}</option>
          </select>
        </label>
      </div>
      <ul className="grid gap-2 text-xs leading-relaxed text-muted sm:grid-cols-3">
        <li className="rounded-lg border border-border bg-background p-3">
          {t("review.noDeploy")}
        </li>
        <li className="rounded-lg border border-border bg-background p-3">
          {t("review.noBaseWrite")}
        </li>
        <li className="rounded-lg border border-border bg-background p-3">
          {t("review.sensitiveApproval")}
        </li>
      </ul>
    </fieldset>
  );
}
