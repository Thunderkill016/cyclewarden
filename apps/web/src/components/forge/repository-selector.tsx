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
    <fieldset className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <legend className="px-2 text-sm font-semibold text-foreground">
        {t("repository.legend")}
      </legend>
      <p className="text-sm leading-relaxed text-muted">
        {t("repository.description")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {repositories.map((repository) => {
          const disabled = !repository.supported || repository.status !== "active";
          return (
            <label
              key={repository.id}
              className={`rounded-xl border p-4 text-sm transition-colors ${
                disabled
                  ? "cursor-not-allowed border-border bg-background opacity-60"
                  : "cursor-pointer border-border bg-background hover:border-accent"
              }`}
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="repositoryId"
                  value={repository.id}
                  defaultChecked={repository.id === defaultRepositoryId}
                  disabled={disabled}
                  required={!disabled}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">
                    {repository.namespace}/{repository.name}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {repository.description}
                  </span>
                  <span className="mt-2 inline-flex rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">
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
