"use client";

import Link from "next/link";
import { useState } from "react";

import { createForgeTranslator } from "@/lib/forge/i18n";
import {
  initialForgeLanguageState,
  switchForgeInterfaceLocale,
  type ForgeLanguageState,
} from "@/lib/forge/language-state";
import type { ForgeRepositoryOption } from "@/lib/forge/repositories";
import { ForgeStartForm } from "./forge-start-form";

export function ForgeStartShell({
  actor,
  repositories,
}: {
  actor: { displayName: string; demo: boolean };
  repositories: ForgeRepositoryOption[];
}) {
  const [languages, setLanguages] = useState<ForgeLanguageState>(
    initialForgeLanguageState,
  );
  const t = createForgeTranslator(languages.interfaceLocale);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {t("start.eyebrow")}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
            {t("start.title")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            {t("start.description")}
          </p>
        </div>
        <Link
          href="/app"
          className="rounded-xl border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          {t("start.back")}
        </Link>
      </header>

      <section className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted">
            {t("start.actor")}: {" "}
            <span className="font-medium text-foreground">{actor.displayName}</span>
          </span>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">
            {actor.demo ? t("start.demoMode") : t("start.authenticatedWorkspace")}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
          <div>
            <p className="text-sm font-medium text-foreground">{t("language.interface")}</p>
            <p className="mt-1 text-xs text-muted">{t("language.switchHint")}</p>
          </div>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("language.interface")}>
            {(["vi", "en"] as const).map((locale) => (
              <button
                key={locale}
                type="button"
                data-testid={`forge-locale-${locale}`}
                aria-pressed={languages.interfaceLocale === locale}
                onClick={() =>
                  setLanguages((current) => switchForgeInterfaceLocale(current, locale))
                }
                className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent"
              >
                {locale === "vi" ? "Tiếng Việt" : "English"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <ForgeStartForm
        repositories={repositories}
        languages={languages}
        onLanguagesChange={setLanguages}
      />
    </main>
  );
}
