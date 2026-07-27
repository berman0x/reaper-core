import { createFileRoute } from "@tanstack/react-router";
import { PAYLOAD_MAP } from "@/lib/payloads";

// Server-Sent Events stream that emits scripted payload output line-by-line.
// Cloudflare Workers can't host raw WebSockets or spawn subprocesses, so this
// is the closest safe stand-in: a real streaming HTTP response the client
// consumes with EventSource. The client aborts the request to STOP; the
// server observes request.signal and stops emitting further lines.

export const Route = createFileRoute("/api/execute")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const target = (url.searchParams.get("target") ?? "").trim();
        const payloadId = url.searchParams.get("payload") ?? "";
        const execId = url.searchParams.get("id") ?? crypto.randomUUID();

        const payload = PAYLOAD_MAP[payloadId];

        const encoder = new TextEncoder();
        const send = (
          controller: ReadableStreamDefaultController<Uint8Array>,
          event: string,
          data: unknown,
        ) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const signal = request.signal;
            let closed = false;
            const finish = () => {
              if (closed) return;
              closed = true;
              try {
                controller.close();
              } catch {
                // already closed
              }
            };

            signal.addEventListener("abort", () => {
              try {
                send(controller, "output", {
                  line: "[!] execution aborted by operator",
                  level: "warn",
                });
                send(controller, "done", { status: "stopped", execId });
              } catch {
                // controller already closed
              }
              finish();
            });

            send(controller, "meta", { execId, startedAt: Date.now() });

            if (!target) {
              send(controller, "output", {
                line: "[x] missing target",
                level: "error",
              });
              send(controller, "done", { status: "error", execId });
              finish();
              return;
            }
            if (!payload) {
              send(controller, "output", {
                line: `[x] unknown payload: ${payloadId}`,
                level: "error",
              });
              send(controller, "done", { status: "error", execId });
              finish();
              return;
            }

            try {
              const total = payload.steps.length;
              for (let i = 0; i < total; i++) {
                const step = payload.steps[i];
                if (signal.aborted) return;
                await new Promise((r) => setTimeout(r, step.delayMs));
                if (signal.aborted) return;
                send(controller, "output", {
                  line: step.line(target),
                  level: step.level,
                });
                send(controller, "progress", {
                  pct: Math.round(((i + 1) / total) * 100),
                });
              }
              send(controller, "done", { status: "success", execId });

            } catch (err) {
              send(controller, "output", {
                line: `[x] internal error: ${String(err)}`,
                level: "error",
              });
              send(controller, "done", { status: "error", execId });
            } finally {
              finish();
            }
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
