import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { getAuth, getAuthAdapterName } from "@/lib/auth";
import { getProfile } from "@/lib/profile-store";
import { getI18n } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function AppHomePage() {
  const { t, locale } = await getI18n();
  const user = await getAuth().getUser();
  const adapter = getAuthAdapterName();
  const configured = adapter !== "none";

  const profile = user ? await getProfile(user.id, user.email) : null;
  const displayName = profile?.displayName ?? user?.email?.split("@")[0] ?? "Guest";
  const avatarUrl = profile?.avatarUrl ?? null;

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <header className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <p className="text-xs text-accent">{t("app.tagline")}</p>
          <h1 className="text-xl font-semibold">{t("app.title")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <LocaleSwitcher locale={locale} />
          {user && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-xs font-semibold">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-accent">{displayName[0]?.toUpperCase()}</span>
                )}
              </div>
              <span className="hidden sm:block">{displayName}</span>
            </div>
          )}
          <Link href="/" className="text-sm text-muted transition-colors hover:text-foreground">
            {t("common.landing")}
          </Link>
        </div>
      </header>

      <div className="mt-8 space-y-4">
        {!configured && (
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted">
            {t("app.demoMode")}
          </div>
        )}

        <Link
          href="/app/control-center"
          className="group block rounded-2xl border border-accent/60 bg-accent/10 p-6 transition-colors hover:border-accent"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                Local AI operations
              </p>
              <h2 className="mt-2 text-xl font-semibold text-foreground group-hover:text-accent">
                Open AI Project Control Center
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                Register local repositories, launch bounded Codex tasks in isolated worktrees, watch live state,
                and only surface changes as ready to ship after repository checks pass on a clean exact head.
              </p>
            </div>
            <span className="rounded-full border border-accent/40 px-3 py-1 text-xs text-accent">
              local core →
            </span>
          </div>
        </Link>

        <Link
          href="/app/evolution"
          className="group block rounded-2xl border border-accent/50 bg-accent/5 p-6 transition-colors hover:border-accent"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                Unified product lifecycle
              </p>
              <h2 className="mt-2 text-xl font-semibold text-foreground group-hover:text-accent">
                Open Evolution Workspace
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                Review durable cycles, research sources, claims, contradictions, opportunity decisions,
                reversible experiments, and the typed handoff to governed execution.
              </p>
            </div>
            <span className="rounded-full border border-accent/40 px-3 py-1 text-xs text-accent">
              same CLI state →
            </span>
          </div>
        </Link>

        <Link
          href="/app/evolution/delivery"
          className="group block rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                Governed delivery operations
              </p>
              <h2 className="mt-2 text-lg font-semibold text-foreground group-hover:text-accent">
                Open Delivery Recovery Console
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                Inspect implementation, independent verification, draft publication, process leases,
                and fail-closed recovery without exposing execute, merge or deploy controls.
              </p>
            </div>
            <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">
              inspect & recover →
            </span>
          </div>
        </Link>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              {t("app.adapter")}: <code className="text-foreground">{adapter}</code>
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                configured ? "bg-accent/10 text-accent" : "bg-border text-muted"
              }`}
            >
              {configured ? "active" : "demo"}
            </span>
          </div>
          <p className="mt-3 text-sm text-muted">{t("app.session")}</p>
          <p className="mt-1 font-medium">
            {user?.email ?? (configured ? "—" : "demo@cyclewarden.local")}
          </p>
          {user?.id && (
            <p className="mt-1 break-all font-mono text-xs text-muted">{user.id}</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted">
          <p className="font-medium text-foreground">Current integrated workflow</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>Create an objective and durable cycle.</li>
            <li>Inspect and assess the repository.</li>
            <li>Prepare a research bundle with three opportunities.</li>
            <li>Review the selected experiment and execution handoff in the workspace.</li>
            <li>Inspect durable delivery and recover stale or interrupted operations.</li>
          </ol>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/app/notes"
            className="group rounded-xl border border-border bg-card p-5 text-sm transition-colors hover:border-accent"
          >
            <p className="font-medium text-foreground transition-colors group-hover:text-accent">
              {t("app.notesCard")}
            </p>
            <p className="mt-2 text-muted">{t("app.notesDesc")}</p>
          </Link>
          <Link
            href="/app/profile"
            className="group rounded-xl border border-border bg-card p-5 text-sm transition-colors hover:border-accent"
          >
            <p className="font-medium text-foreground transition-colors group-hover:text-accent">
              {t("app.profileCard")}
            </p>
            <p className="mt-2 text-muted">{t("app.profileDesc")}</p>
          </Link>
          <Link
            href="/app/billing"
            className="group rounded-xl border border-border bg-card p-5 text-sm transition-colors hover:border-accent"
          >
            <p className="font-medium text-foreground transition-colors group-hover:text-accent">
              {t("app.billingCard")}
            </p>
            <p className="mt-2 text-muted">{t("app.billingDesc")}</p>
          </Link>
        </div>

        {user && (
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-xl border border-border px-4 py-2 text-sm transition-colors hover:border-accent"
            >
              {t("auth.signOut")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
