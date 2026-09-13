"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

const CORE_URL = process.env.NEXT_PUBLIC_CONTROL_CORE_URL ?? "http://127.0.0.1:4318";

type VerificationResult = {
  name: string;
  ok: boolean;
  exitCode: number | null;
  durationMs: number;
  output: string;
};

type Recovery = {
  canResume: boolean;
  reason: string;
  worktreeExists?: boolean;
  branchExists?: boolean;
  branch?: string | null;
  worktreePath?: string | null;
  clean?: boolean | null;
  exactHead?: string | null;
  changedFiles?: string[];
  error?: string | null;
  inspectedAt?: string;
};

type Task = {
  id: string;
  projectId: string;
  title: string;
  objective: string;
  status: string;
  agent: string;
  branch: string | null;
  worktreePath: string | null;
  externalThreadId: string | null;
  exactHead: string | null;
  lastMessage: string | null;
  verification: VerificationResult[];
  recovery?: Recovery | null;
  failure?: { code: string; message: string } | null;
  evidence?: { clean: boolean; changedFiles: string[]; statSummary: string };
  updatedAt: string;
};

type ProjectHealth = {
  available: boolean;
  head: string | null;
  branch: string | null;
  dirty: boolean | null;
  changedFiles: number | null;
  headMoved: boolean | null;
  error?: string | null;
  checkedAt?: string;
};

type Project = {
  id: string;
  name: string;
  rootPath: string;
  agentsPath: string | null;
  contractPath: string | null;
  packageManager: string;
  verification: { name: string; command: string; args: string[] }[];
  health?: ProjectHealth | null;
  taskCounts: { total: number; active: number; blocked: number; readyToShip: number };
};

type Snapshot = {
  generatedAt: string;
  projects: Project[];
  needsYou: Task[];
  readyToShip: Task[];
  inFlight: Task[];
  backlog: Task[];
};

type Doctor = {
  ok: boolean;
  git: { ok: boolean; version?: string; error?: string };
  codex: { ok: boolean; version?: string; error?: string };
  projectWatcher?: { running: boolean; intervalMs: number; lastSweepAt: string | null; lastError: string | null };
};

async function coreFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CORE_URL}${path}`, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...(init?.headers ?? {}) } : init?.headers,
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message ?? body?.error ?? `Core returned ${response.status}`);
  return body as T;
}

function relativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  const seconds = Math.max(0, Math.round(delta / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function StatusDot({ kind }: { kind: "good" | "warn" | "busy" | "muted" }) {
  const classes = {
    good: "bg-emerald-400",
    warn: "bg-amber-400",
    busy: "bg-sky-400",
    muted: "bg-zinc-500",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${classes[kind]}`} />;
}

function TaskCard({ task, action }: { task: Task; action: (task: Task, verb: "start" | "cancel") => Promise<void> }) {
  const running = task.status === "RUNNING" || task.status === "VERIFYING";
  const interrupted = task.status === "INTERRUPTED";
  const resumable = interrupted && task.recovery?.canResume === true;
  const startable = ["BACKLOG", "READY", "FAILED"].includes(task.status) || resumable;
  const actionLabel = interrupted ? "Resume" : task.status === "FAILED" ? "Retry" : "Run";

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="font-mono">{task.agent}</span>
            <span>·</span>
            <span>{task.status}</span>
            <span>·</span>
            <span>{relativeTime(task.updatedAt)}</span>
          </div>
          <h3 className="mt-1 truncate font-medium text-foreground">{task.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{task.objective}</p>
        </div>
        {running ? (
          <button
            onClick={() => void action(task, "cancel")}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:border-amber-400 hover:text-foreground"
          >
            Cancel
          </button>
        ) : startable ? (
          <button
            onClick={() => void action(task, "start")}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
          >
            {actionLabel}
          </button>
        ) : interrupted ? (
          <span className="shrink-0 rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-300">Inspect recovery</span>
        ) : null}
      </div>

      {task.branch && (
        <div className="mt-3 rounded-lg bg-background/60 px-3 py-2 font-mono text-xs text-muted">
          {task.branch}
          {task.exactHead ? ` · ${task.exactHead.slice(0, 10)}` : ""}
        </div>
      )}

      {interrupted && task.recovery && (
        <div className="mt-3 rounded-xl border border-sky-500/25 bg-sky-500/5 p-3 text-xs text-muted">
          <div className="flex flex-wrap items-center gap-2">
            <span className={task.recovery.canResume ? "text-emerald-300" : "text-amber-300"}>
              {task.recovery.canResume ? "Recovery verified" : "Recovery blocked"}
            </span>
            <span>·</span>
            <span className="font-mono">{task.recovery.reason}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span>worktree: {task.recovery.worktreeExists ? "present" : "missing"}</span>
            <span>branch: {task.recovery.branchExists ? "present" : "missing"}</span>
            {typeof task.recovery.clean === "boolean" && <span>{task.recovery.clean ? "clean" : "dirty"}</span>}
            {task.recovery.changedFiles?.length ? <span>{task.recovery.changedFiles.length} changed files</span> : null}
          </div>
        </div>
      )}

      {task.lastMessage && (
        <p className="mt-3 border-l-2 border-accent/40 pl-3 text-sm leading-relaxed text-muted">
          {task.lastMessage.slice(0, 600)}
        </p>
      )}

      {task.failure && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <p className="font-mono text-xs text-amber-300">{task.failure.code}</p>
          <p className="mt-1 whitespace-pre-wrap text-muted">{task.failure.message.slice(-1200)}</p>
        </div>
      )}

      {task.verification?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {task.verification.map((check) => (
            <span
              key={check.name}
              className={`rounded-full border px-2 py-1 text-xs ${
                check.ok ? "border-emerald-500/30 text-emerald-300" : "border-amber-500/30 text-amber-300"
              }`}
            >
              {check.ok ? "✓" : "×"} {check.name} · {(check.durationMs / 1000).toFixed(1)}s
            </span>
          ))}
        </div>
      )}

      {task.evidence?.changedFiles?.length ? (
        <p className="mt-3 text-xs text-muted">
          {task.evidence.changedFiles.length} changed file{task.evidence.changedFiles.length === 1 ? "" : "s"}
        </p>
      ) : null}
    </article>
  );
}

function Section({ title, count, tone, children }: { title: string; count: number; tone: "warn" | "good" | "busy" | "muted"; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <StatusDot kind={tone} />
        <h2 className="text-xs font-semibold tracking-[0.18em] text-muted">{title}</h2>
        <span className="rounded-full bg-card px-2 py-0.5 font-mono text-xs text-muted">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ProjectHealthBadge({ health }: { health?: ProjectHealth | null }) {
  if (!health) return <span className="rounded border border-border px-1.5 py-0.5 text-muted">health ?</span>;
  if (!health.available) return <span className="rounded border border-rose-500/30 px-1.5 py-0.5 text-rose-300">repo offline</span>;
  if (health.dirty) return <span className="rounded border border-amber-500/30 px-1.5 py-0.5 text-amber-300">dirty {health.changedFiles ?? 0}</span>;
  if (health.headMoved) return <span className="rounded border border-sky-500/30 px-1.5 py-0.5 text-sky-300">HEAD moved</span>;
  return <span className="rounded border border-emerald-500/30 px-1.5 py-0.5 text-emerald-300">repo healthy</span>;
}

export function ControlCenterClient() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [repoPath, setRepoPath] = useState("");
  const [projectId, setProjectId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskObjective, setTaskObjective] = useState("");

  const refresh = useCallback(async () => {
    try {
      const next = await coreFetch<Snapshot>("/snapshot");
      setSnapshot(next);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }, []);

  useEffect(() => {
    void refresh();
    void coreFetch<Doctor>("/doctor").then(setDoctor).catch(() => setDoctor(null));

    const source = new EventSource(`${CORE_URL}/events`);
    const onSnapshot = (event: MessageEvent<string>) => {
      try {
        setSnapshot(JSON.parse(event.data) as Snapshot);
        setStreamConnected(true);
        setError(null);
      } catch {
        setStreamConnected(false);
      }
    };
    source.addEventListener("snapshot", onSnapshot as EventListener);
    source.onopen = () => setStreamConnected(true);
    source.onerror = () => setStreamConnected(false);

    return () => {
      source.removeEventListener("snapshot", onSnapshot as EventListener);
      source.close();
    };
  }, [refresh]);

  useEffect(() => {
    if (!projectId && snapshot?.projects[0]) setProjectId(snapshot.projects[0].id);
  }, [projectId, snapshot]);

  const projectById = useMemo(
    () => new Map((snapshot?.projects ?? []).map((project) => [project.id, project])),
    [snapshot],
  );
  const selectedProject = projectId ? projectById.get(projectId) : null;

  async function mutate<T>(work: () => Promise<T>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      if (!streamConnected) await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  }

  function registerProject(event: FormEvent) {
    event.preventDefault();
    if (!repoPath.trim()) return;
    void mutate(async () => {
      await coreFetch("/projects", { method: "POST", body: JSON.stringify({ path: repoPath.trim() }) });
      setRepoPath("");
    });
  }

  function createTask(event: FormEvent) {
    event.preventDefault();
    if (!projectId || !taskTitle.trim() || !taskObjective.trim()) return;
    void mutate(async () => {
      await coreFetch("/tasks", {
        method: "POST",
        body: JSON.stringify({ projectId, title: taskTitle.trim(), objective: taskObjective.trim() }),
      });
      setTaskTitle("");
      setTaskObjective("");
    });
  }

  async function taskAction(task: Task, verb: "start" | "cancel") {
    await mutate(() => coreFetch(`/tasks/${encodeURIComponent(task.id)}/${verb}`, { method: "POST", body: "{}" }));
  }

  const projectName = (task: Task) => projectById.get(task.projectId)?.name ?? task.projectId;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">CycleWarden / local core</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">AI Project Control Center</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Một nơi để thấy agent nào đang chạy, cái gì cần quyết định và thay đổi nào đã đủ bằng chứng để ship.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full border px-3 py-1 ${doctor?.git.ok ? "border-emerald-500/30 text-emerald-300" : "border-border text-muted"}`}>
            Git {doctor?.git.ok ? "online" : "?"}
          </span>
          <span className={`rounded-full border px-3 py-1 ${doctor?.codex.ok ? "border-emerald-500/30 text-emerald-300" : "border-amber-500/30 text-amber-300"}`}>
            Codex {doctor?.codex.ok ? "online" : "offline"}
          </span>
          <span className={`rounded-full border px-3 py-1 ${doctor?.projectWatcher?.running ? "border-emerald-500/30 text-emerald-300" : "border-border text-muted"}`}>
            Watcher {doctor?.projectWatcher?.running ? "online" : "?"}
          </span>
          <span className={`rounded-full border px-3 py-1 ${error ? "border-amber-500/30 text-amber-300" : streamConnected ? "border-emerald-500/30 text-emerald-300" : "border-sky-500/30 text-sky-300"}`}>
            Core {error ? "offline" : streamConnected ? "live" : "connecting"}
          </span>
        </div>
      </header>

      {error && (
        <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-100">
          <p className="font-medium">Không kết nối được local core.</p>
          <p className="mt-1 text-muted">{error}</p>
          <code className="mt-3 block rounded-lg bg-background px-3 py-2 text-xs text-foreground">pnpm control:start</code>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-8">
          <Section title="NEEDS YOU" count={snapshot?.needsYou.length ?? 0} tone="warn">
            {snapshot?.needsYou.length ? snapshot.needsYou.map((task) => (
              <div key={task.id}>
                <p className="mb-1 text-xs text-muted">{projectName(task)}</p>
                <TaskCard task={task} action={taskAction} />
              </div>
            )) : <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted">Không có task nào đang chờ bạn.</p>}
          </Section>

          <Section title="READY TO SHIP" count={snapshot?.readyToShip.length ?? 0} tone="good">
            {snapshot?.readyToShip.length ? snapshot.readyToShip.map((task) => (
              <div key={task.id}>
                <p className="mb-1 text-xs text-muted">{projectName(task)}</p>
                <TaskCard task={task} action={taskAction} />
              </div>
            )) : <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted">Chưa có thay đổi nào vượt qua verification.</p>}
          </Section>

          <Section title="IN FLIGHT" count={snapshot?.inFlight.length ?? 0} tone="busy">
            {snapshot?.inFlight.length ? snapshot.inFlight.map((task) => (
              <div key={task.id}>
                <p className="mb-1 text-xs text-muted">{projectName(task)}</p>
                <TaskCard task={task} action={taskAction} />
              </div>
            )) : <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted">Không có agent đang chạy.</p>}
          </Section>

          <Section title="BACKLOG" count={snapshot?.backlog.length ?? 0} tone="muted">
            {snapshot?.backlog.length ? snapshot.backlog.map((task) => (
              <div key={task.id}>
                <p className="mb-1 text-xs text-muted">{projectName(task)}</p>
                <TaskCard task={task} action={taskAction} />
              </div>
            )) : <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted">Tạo task đầu tiên ở panel bên phải.</p>}
          </Section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <form onSubmit={registerProject} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted">REGISTER PROJECT</p>
            <label className="mt-4 block text-xs text-muted" htmlFor="repo-path">Absolute repo path</label>
            <input
              id="repo-path"
              value={repoPath}
              onChange={(event) => setRepoPath(event.target.value)}
              placeholder="/home/user/Code/project"
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button disabled={busy} className="mt-3 w-full rounded-xl border border-border px-3 py-2 text-sm hover:border-accent disabled:opacity-50">
              Add repository
            </button>
          </form>

          <form onSubmit={createTask} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted">NEW TASK</p>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select project</option>
              {(snapshot?.projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            {selectedProject?.health?.available === false && (
              <p className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/5 px-3 py-2 text-xs text-rose-200">
                Repository unavailable. New tasks are blocked until the watcher sees it again.
              </p>
            )}
            <input
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder="Task title"
              className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <textarea
              value={taskObjective}
              onChange={(event) => setTaskObjective(event.target.value)}
              placeholder="What should Codex accomplish?"
              rows={5}
              className="mt-3 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              disabled={busy || !projectId || selectedProject?.health?.available === false}
              className="mt-3 w-full rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              Add to backlog
            </button>
          </form>

          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-[0.16em] text-muted">PROJECTS</p>
              <span className="font-mono text-xs text-muted">{snapshot?.projects.length ?? 0}</span>
            </div>
            <div className="mt-3 space-y-3">
              {(snapshot?.projects ?? []).map((project) => (
                <div key={project.id} className="rounded-xl border border-border bg-background/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{project.name}</p>
                    <span className="font-mono text-xs text-muted">{project.taskCounts.active} active</span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-muted">{project.rootPath}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted">
                    <ProjectHealthBadge health={project.health} />
                    {project.health?.branch && <span className="rounded border border-border px-1.5 py-0.5">{project.health.branch}</span>}
                    {project.agentsPath && <span className="rounded border border-border px-1.5 py-0.5">AGENTS</span>}
                    {project.contractPath && <span className="rounded border border-border px-1.5 py-0.5">contract</span>}
                    {project.verification.map((check) => <span key={check.name} className="rounded border border-border px-1.5 py-0.5">{check.name}</span>)}
                  </div>
                </div>
              ))}
              {!snapshot?.projects.length && <p className="text-sm text-muted">Chưa đăng ký repo.</p>}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
