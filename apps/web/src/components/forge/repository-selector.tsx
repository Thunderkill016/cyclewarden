import type { Locale } from "@cyclewarden/i18n";

import { createForgeTranslator } from "@/lib/forge/i18n";
import type { ForgeRepositoryOption } from "@/lib/forge/repositories";

export function RepositorySelector({
  repositories,
  defaultRepositoryId,
  locale,
}: {
  repositories: ForgeRepositoryOption[];
  defaultRepositoryId?: string;
  locale: Locale;
}) {
  const t = createForgeTranslator(locale);

  return (
    <fieldset className="min-w-0 space-y-3 overflow-hidden rounded-2xl border border-border bg-card p-5">
      <legend className="px-2 text-sm font-semibold text-foreground">
        {t("repository.legend")}
      </legend>
      <p className="break-words text-sm leading-relaxed text-muted">
        {t("repository.description")}
      </p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {repositories.map((repository) => {
          const disabled = !repository.supported || repository.status !== "active";
          return (
            <label
              key={repository.id}
              className={`min-h-20 min-w-0 rounded-xl border p-4 text-sm transition-colors ${
                disabled
                  ? "cursor-not-allowed border-border bg-background opacity-60"
                  : "cursor-pointer border-border bg-background hover:border-accent focus-within:border-accent"
              }`}
            >
              <span className="flex min-w-0 items-start gap-3">
                <input
                  type="radio"
                  name="repositoryId"
                  value={repository.id}
                  defaultChecked={repository.id === defaultRepositoryId}
                  disabled={disabled}
                  required={!disabled}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
                />
                <span className="min-w-0">
                  <span className="block break-all font-medium text-foreground">
                    {repository.namespace}/{repository.name}
                  </span>
                  <span className="mt-1 block break-words text-xs text-muted">
                    {repository.description}
                  </span>
                  <span className="mt-2 inline-flex max-w-full break-all rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">
                    {repository.status}
                  </span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
