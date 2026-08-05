import type { ForgeRunEventView } from "@/lib/forge/run-control-service";

function eventTitle(type: string): string {
  const titles: Record<string, string> = {
    "run.created": "Run created",
    "run.instruction.added": "Instruction added",
    "approval.requested": "Approval requested",
    "approval.resolved": "Approval resolved",
    "run.cancel.requested": "Cancellation requested",
    "run.cancelled": "Run cancelled",
  };
  return titles[type] ?? type.replaceAll(".", " ");
}

function eventDetail(event: ForgeRunEventView): string | null {
  const payload = event.payload as Record<string, unknown> | null;
  if (!payload) return null;
  if (typeof payload.instruction === "string") return payload.instruction;
  if (typeof payload.summary === "string") return payload.summary;
  if (typeof payload.reason === "string") return payload.reason;
  if (typeof payload.status === "string") return `Decision: ${payload.status}`;
  return null;
}

export function RunActivityFeed({ events }: { events: ForgeRunEventView[] }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Ordered event stream
          </p>
          <h2 className="mt-1 break-words text-lg font-semibold text-foreground">
            Run activity
          </h2>
        </div>
        <span className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted">
          {events.length} events
        </span>
      </div>

      <ol data-testid="forge-event-feed" className="mt-5 min-w-0 space-y-3">
        {events.map((event) => {
          const detail = eventDetail(event);
          return (
            <li
              key={event.sequence}
              data-event-sequence={event.sequence}
              className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 overflow-hidden rounded-xl border border-border bg-background p-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/40 font-mono text-xs text-accent">
                {event.sequence}
              </span>
              <div className="min-w-0 overflow-hidden">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 break-words font-medium text-foreground">
                    {eventTitle(event.type)}
                  </p>
                  <time className="shrink-0 text-xs text-muted" dateTime={event.createdAt}>
                    {new Date(event.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </time>
                </div>
                <p className="mt-1 break-all font-mono text-xs text-muted">{event.type}</p>
                {detail && <p className="mt-2 break-words text-sm text-muted">{detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
