import { getForgeActor } from "@/lib/forge/actor";
import { forgeRunErrorResponse } from "@/lib/forge/run-control-http";
import {
  getForgeRunEvents,
  type ForgeRunEventView,
} from "@/lib/forge/run-control-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

function parseCursor(request: Request): number {
  const url = new URL(request.url);
  const raw = request.headers.get("last-event-id") ?? url.searchParams.get("after") ?? "0";
  const cursor = Number(raw);
  return Number.isInteger(cursor) && cursor >= 0 ? cursor : 0;
}

function encodeEvent(event: ForgeRunEventView): Uint8Array {
  return encoder.encode(
    `id: ${event.sequence}\nevent: forge\ndata: ${JSON.stringify(event)}\n\n`,
  );
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const [{ runId }, actor] = await Promise.all([context.params, getForgeActor()]);
    const startingCursor = parseCursor(request);
    const history = await getForgeRunEvents(actor, runId, startingCursor);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let cursor = startingCursor;
        let closed = false;

        const close = () => {
          if (closed) return;
          closed = true;
          controller.close();
        };
        request.signal.addEventListener("abort", close, { once: true });

        void (async () => {
          controller.enqueue(encoder.encode("retry: 1500\n\n"));
          for (const event of history) {
            if (closed) return;
            controller.enqueue(encodeEvent(event));
            cursor = Math.max(cursor, event.sequence);
          }

          const expiresAt = Date.now() + 25_000;
          while (!closed && Date.now() < expiresAt) {
            await delay(750);
            if (closed) return;
            const events = await getForgeRunEvents(actor, runId, cursor);
            if (events.length === 0) {
              controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
              continue;
            }
            for (const event of events) {
              controller.enqueue(encodeEvent(event));
              cursor = Math.max(cursor, event.sequence);
            }
          }
          close();
        })().catch(() => close());
      },
      cancel() {
        // The request abort listener closes the stream and stops the polling loop.
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return forgeRunErrorResponse(error);
  }
}
