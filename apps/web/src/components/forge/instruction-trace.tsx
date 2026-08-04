import type { Locale } from "@cyclewarden/i18n";

import { createForgeTranslator } from "@/lib/forge/i18n";

export function InstructionTrace({
  interfaceLocale,
  instructionLanguage,
  technicalOutputLanguage,
  originalInstruction,
  normalizedObjective,
}: {
  interfaceLocale: Locale;
  instructionLanguage: Locale;
  technicalOutputLanguage: Locale;
  originalInstruction: string;
  normalizedObjective: string;
}) {
  const t = createForgeTranslator(interfaceLocale);

  return (
    <section
      data-testid="forge-instruction-trace"
      className="rounded-2xl border border-border bg-card p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">{t("trace.title")}</h2>
        <dl className="flex flex-wrap gap-2 text-xs text-muted">
          <div className="rounded-full border border-border px-3 py-1">
            <dt className="inline">{t("trace.interfaceLocale")}: </dt>
            <dd className="inline font-mono text-foreground">{interfaceLocale}</dd>
          </div>
          <div className="rounded-full border border-border px-3 py-1">
            <dt className="inline">{t("trace.instructionLanguage")}: </dt>
            <dd className="inline font-mono text-foreground">{instructionLanguage}</dd>
          </div>
          <div className="rounded-full border border-border px-3 py-1">
            <dt className="inline">{t("trace.technicalOutputLanguage")}: </dt>
            <dd className="inline font-mono text-foreground">{technicalOutputLanguage}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-background p-4">
          <h3 className="text-sm font-semibold text-foreground">{t("trace.original")}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
            {originalInstruction}
          </p>
        </article>
        <article className="rounded-xl border border-accent/40 bg-accent/5 p-4">
          <h3 className="text-sm font-semibold text-accent">{t("trace.normalized")}</h3>
          <p
            data-testid="forge-normalized-objective"
            className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground"
          >
            {normalizedObjective}
          </p>
        </article>
      </div>
    </section>
  );
}
