import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Square,
  Trash2,
  Download,
  Terminal as TermIcon,
  ChevronLeft,
  History as HistoryIcon,
  Zap,
} from "lucide-react";
import { PAYLOADS } from "@/lib/payloads";
import { useExecutionStore, type OutputLine } from "@/stores/reaper-execution";

export const Route = createFileRoute("/terminal")({
  head: () => ({
    meta: [
      { title: "Reaper // Execution Terminal" },
      {
        name: "description",
        content:
          "Real-time execution terminal for the Reaper platform — stream scripted payloads against a target with live output.",
      },
      { property: "og:title", content: "Reaper // Execution Terminal" },
      {
        property: "og:description",
        content:
          "Real-time execution terminal for the Reaper platform with live streaming output.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TerminalPage,
});

function TerminalPage() {
  const {
    target,
    payload,
    output,
    status,
    history,
    setTarget,
    setPayload,
    appendLine,
    reset,
    clearAll,
    beginExecution,
    finishExecution,
  } = useExecutionStore();

  const abortRef = useRef<AbortController | null>(null);
  const termRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // auto-scroll to bottom on new lines
  useEffect(() => {
    if (!autoScroll) return;
    const el = termRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [output, autoScroll]);

  // detect manual scroll-up to pause auto-scroll
  const onScroll = () => {
    const el = termRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

  // cleanup on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const isExecuting = status === "executing";

  const execute = async () => {
    if (isExecuting) return;
    const t = target.trim();
    if (!t) {
      appendLine("[x] target required", "error");
      return;
    }
    const execId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now());
    beginExecution(execId);

    const ac = new AbortController();
    abortRef.current = ac;

    const qs = new URLSearchParams({ target: t, payload, id: execId });
    let finalOutcome: "success" | "error" | "stopped" = "error";

    try {
      const res = await fetch(`/api/execute?${qs.toString()}`, {
        signal: ac.signal,
        headers: { Accept: "text/event-stream" },
      });
      if (!res.ok || !res.body) {
        appendLine(`[x] stream failed (${res.status})`, "error");
        finishExecution("error");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // parse SSE frames separated by blank lines
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const evtMatch = frame.match(/^event: (.+)$/m);
          const dataMatch = frame.match(/^data: (.+)$/m);
          if (!evtMatch || !dataMatch) continue;
          const evt = evtMatch[1];
          let data: unknown;
          try {
            data = JSON.parse(dataMatch[1]);
          } catch {
            continue;
          }
          if (evt === "output") {
            const d = data as { line: string; level: OutputLine["level"] };
            appendLine(d.line, d.level);
          } else if (evt === "done") {
            const d = data as { status: "success" | "error" | "stopped" };
            finalOutcome = d.status;
          }
        }
      }
      finishExecution(finalOutcome);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        appendLine("[!] connection closed by operator", "warn");
        finishExecution("stopped");
      } else {
        appendLine(`[x] ${(err as Error).message}`, "error");
        finishExecution("error");
      }
    } finally {
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const exportLog = () => {
    const lines = output
      .map((o) => {
        const ts = new Date(o.ts).toISOString();
        return `[${ts}] [${o.level.toUpperCase()}] ${o.line}`;
      })
      .join("\n");
    const header = [
      `# Reaper execution log`,
      `# target:  ${target}`,
      `# payload: ${payload}`,
      `# exported: ${new Date().toISOString()}`,
      "",
    ].join("\n");
    const blob = new Blob([header + lines + "\n"], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reaper-${payload}-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusInfo = useMemo(() => {
    switch (status) {
      case "executing":
        return { label: "EXECUTING", color: "var(--cyan)" };
      case "success":
        return { label: "SUCCESS", color: "var(--neon)" };
      case "error":
        return { label: "ERROR", color: "var(--danger)" };
      case "stopped":
        return { label: "STOPPED", color: "var(--warn)" };
      default:
        return { label: "IDLE", color: "var(--muted-foreground)" };
    }
  }, [status]);

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
      <div className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="panel flex flex-wrap items-center gap-4 px-4 py-3 sm:px-5">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-[color:var(--surface-2)] px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md border border-[color:var(--cyan)]/40 bg-[color:var(--surface-2)] glow-cyan">
              <TermIcon className="h-4 w-4 text-[color:var(--cyan)]" />
            </div>
            <div>
              <div className="font-mono text-sm font-semibold tracking-[0.3em]">
                EXEC TERMINAL
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Reaper Payload Runtime
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <StatusPill label={statusInfo.label} color={statusInfo.color} />
          </div>
        </header>

        {/* Control bar */}
        <section className="panel grid grid-cols-1 gap-3 p-4 md:grid-cols-[minmax(0,1fr)_260px_auto]">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Target
            </span>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="host.example.com or 10.0.0.4"
              disabled={isExecuting}
              className="w-full rounded-md border border-border/60 bg-[color:var(--surface-2)] px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-[color:var(--cyan)]/60 focus:outline-none disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Payload
            </span>
            <select
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              disabled={isExecuting}
              className="w-full rounded-md border border-border/60 bg-[color:var(--surface-2)] px-3 py-2 font-mono text-sm text-foreground focus:border-[color:var(--cyan)]/60 focus:outline-none disabled:opacity-60"
            >
              {PAYLOADS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              onClick={execute}
              disabled={isExecuting || !target.trim()}
              className="inline-flex items-center gap-2 rounded-md border border-[color:var(--neon)]/50 bg-[color:var(--neon)]/10 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-[color:var(--neon)] glow-neon transition hover:bg-[color:var(--neon)]/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isExecuting ? (
                <>
                  <Zap className="h-3.5 w-3.5 animate-pulse" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Execute
                </>
              )}
            </button>
            <button
              onClick={stop}
              disabled={!isExecuting}
              className="inline-flex items-center gap-2 rounded-md border border-[color:var(--danger)]/50 bg-[color:var(--danger)]/10 px-3 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-[color:var(--danger)] transition hover:bg-[color:var(--danger)]/20 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </button>
          </div>
        </section>

        {/* Terminal + History */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          {/* Terminal */}
          <div className="panel flex min-h-[520px] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[color:var(--danger)]/70" />
                <span className="h-2 w-2 rounded-full bg-[color:var(--warn)]/70" />
                <span className="h-2 w-2 rounded-full bg-[color:var(--neon)]/70" />
                <span className="ml-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  /dev/reaper/pty
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <IconBtn
                  label="Export .log"
                  onClick={exportLog}
                  disabled={output.length === 0}
                >
                  <Download className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn
                  label="Clear terminal & history"
                  onClick={() => {
                    abortRef.current?.abort();
                    clearAll();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            </div>
            <div
              ref={termRef}
              onScroll={onScroll}
              className="flex-1 overflow-y-auto bg-black/40 px-4 py-3 font-mono text-[12.5px] leading-[1.55]"
            >
              {mounted && output.length === 0 ? (
                <div className="text-muted-foreground/60">
                  {"// awaiting execution. set target, choose payload, hit EXECUTE."}
                </div>
              ) : (
                output.map((o) => (
                  <div key={o.id} className={levelClass(o.level)}>
                    <span className="text-muted-foreground/50">
                      {formatTime(o.ts)}{" "}
                    </span>
                    {o.line}
                  </div>
                ))
              )}
              {isExecuting && (
                <div className="mt-1 inline-block h-3.5 w-2 animate-pulse bg-[color:var(--neon)]" />
              )}
            </div>
            <div className="border-t border-border/50 px-4 pt-2">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="truncate">
                  module{" "}
                  <span className="text-[color:var(--cyan)]">
              <span>
                lines <span className="text-foreground">{output.length}</span>
              </span>
              <span>
                autoscroll{" "}
                <span className="text-foreground">
                  {autoScroll ? "on" : "paused"}
                </span>
              </span>
              <span>
                state{" "}
                <span style={{ color: statusInfo.color }}>{statusInfo.label}</span>
              </span>
            </div>
          </div>

          {/* History */}
          <div className="panel flex min-h-[520px] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <HistoryIcon className="h-4 w-4 text-[color:var(--gold)]" />
                <span className="font-mono text-[11px] uppercase tracking-widest">
                  History
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                last {history.length}/10
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {!mounted ? null : history.length === 0 ? (
                <div className="p-3 font-mono text-xs text-muted-foreground/60">
                  no executions yet.
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      className="rounded-md border border-border/50 bg-[color:var(--surface-2)]/60 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="font-mono text-[10px] uppercase tracking-widest"
                          style={{ color: outcomeColor(h.outcome) }}
                        >
                          {h.outcome}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {new Date(h.finishedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-1 truncate font-mono text-[12px] text-foreground">
                        {h.target}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
                        <span>{h.payload}</span>
                        <span>
                          {h.lineCount} ln ·{" "}
                          {Math.max(
                            1,
                            Math.round((h.finishedAt - h.startedAt) / 1000),
                          )}
                          s
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 pb-4 pt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>REAPER // EXEC v1.0 · SSE STREAM</span>
          <button
            onClick={reset}
            className="rounded border border-border/50 px-2 py-1 hover:text-foreground"
          >
            reset terminal
          </button>
        </footer>
      </div>
    </div>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest"
      style={{ borderColor: `${color}`, color }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      {label}
    </span>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className="inline-flex h-7 w-7 items-center justify-center rounded border border-border/60 text-muted-foreground transition hover:border-[color:var(--cyan)]/60 hover:text-[color:var(--cyan)] disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function levelClass(level: OutputLine["level"]): string {
  switch (level) {
    case "success":
      return "text-[color:var(--neon)]";
    case "error":
      return "text-[color:var(--danger)]";
    case "warn":
      return "text-[color:var(--warn)]";
    case "cmd":
      return "text-[color:var(--cyan)]";
    default:
      return "text-foreground/85";
  }
}

function outcomeColor(o: string): string {
  if (o === "success") return "var(--neon)";
  if (o === "error") return "var(--danger)";
  if (o === "stopped") return "var(--warn)";
  return "var(--muted-foreground)";
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
