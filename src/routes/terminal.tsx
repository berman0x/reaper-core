import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Square,
  Trash2,
  Download,
  Terminal as TermIcon,
  ChevronLeft,
  History as HistoryIcon,
  Zap,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Renders a [█████░░░░░] 47% style ASCII progress bar. */
function bar(pct: number, width = 18): string {
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * width);
  return `[${"█".repeat(filled)}${"░".repeat(width - filled)}] ${String(pct).padStart(3)}%`;
}

function TerminalPage() {
  const {
    target,
    payload,
    output,
    status,
    history,
    targetHistory,
    soundEnabled,
    setTarget,
    setPayload,
    appendLine,
    beginLine,
    growLine,
    pushTargetHistory,
    toggleSound,
    reset,
    clearHistory,
    beginExecution,
    finishExecution,
  } = useExecutionStore();

  const abortRef = useRef<AbortController | null>(null);
  const termRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [scrollLocked, setScrollLocked] = useState(false); // user-forced lock
  const [mounted, setMounted] = useState(false);
  const [minimal, setMinimal] = useState(false);
  const [progress, setProgress] = useState(0);
  const [histIndex, setHistIndex] = useState(-1);

  useEffect(() => setMounted(true), []);

  const isExecuting = status === "executing";

  /* ---------------------------- typing sound ---------------------------- */
  const audioRef = useRef<AudioContext | null>(null);
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;

  const click = useCallback(() => {
    if (!soundRef.current) return;
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!audioRef.current) audioRef.current = new Ctx();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 1400 + Math.random() * 500;
      gain.gain.setValueAtTime(0.015, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.02);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.025);
    } catch {
      // audio unavailable — silently ignore
    }
  }, []);

  /* ------------------------- typewriter pipeline ------------------------ */
  const queueRef = useRef<{ line: string; level: OutputLine["level"] }[]>([]);
  const drainingRef = useRef(false);
  const cancelRef = useRef(0);
  const doneRef = useRef<"success" | "error" | "stopped" | null>(null);

  const drain = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    const token = cancelRef.current;

    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift()!;
      if (cancelRef.current !== token) break;
      beginLine(item.level);
      const text = item.line;
      let i = 0;
      // Variable typing speed: bursts of 1-3 chars with a randomized gap,
      // so no two lines print at exactly the same cadence.
      const base = 4 + Math.random() * 10;
      while (i < text.length) {
        if (cancelRef.current !== token) {
          drainingRef.current = false;
          return;
        }
        const chunk = 1 + Math.floor(Math.random() * 3);
        growLine(text.slice(i, i + chunk));
        i += chunk;
        click();
        await sleep(base + Math.random() * 10);
      }
      await sleep(20 + Math.random() * 60);
    }

    drainingRef.current = false;
    if (cancelRef.current === token && doneRef.current) {
      finishExecution(doneRef.current);
      doneRef.current = null;
    }
  }, [beginLine, growLine, click, finishExecution]);

  const enqueue = useCallback(
    (line: string, level: OutputLine["level"]) => {
      queueRef.current.push({ line, level });
      void drain();
    },
    [drain],
  );

  /* ------------------------------ scrolling ----------------------------- */
  useEffect(() => {
    if (scrollLocked || !autoScroll) return;
    const el = termRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [output, autoScroll, scrollLocked]);

  const onScroll = () => {
    if (scrollLocked) return;
    const el = termRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  /* ------------------------------ execution ----------------------------- */
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

    cancelRef.current++;
    queueRef.current = [];
    doneRef.current = null;
    drainingRef.current = false;
    setProgress(0);
    setHistIndex(-1);
    pushTargetHistory(t);
    beginExecution(execId);

    const ac = new AbortController();
    abortRef.current = ac;

    const qs = new URLSearchParams({ target: t, payload, id: execId });
    let finalOutcome: "success" | "error" | "stopped" = "error";

    const settle = (outcome: "success" | "error" | "stopped") => {
      if (drainingRef.current || queueRef.current.length > 0) {
        doneRef.current = outcome;
      } else {
        finishExecution(outcome);
      }
    };

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
            enqueue(d.line, d.level);
          } else if (evt === "progress") {
            setProgress((data as { pct: number }).pct);
          } else if (evt === "done") {
            const d = data as { status: "success" | "error" | "stopped" };
            finalOutcome = d.status;
          }
        }
      }
      settle(finalOutcome);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        cancelRef.current++;
        queueRef.current = [];
        appendLine("[!] connection closed by operator", "warn");
        finishExecution("stopped");
      } else {
        appendLine(`[x] ${(err as Error).message}`, "error");
        settle("error");
      }
    } finally {
      abortRef.current = null;
    }
  };

  const stop = () => {
    cancelRef.current++;
    queueRef.current = [];
    abortRef.current?.abort();
  };

  // CLEAR wipes the terminal only — execution history is preserved.
  const clearTerminal = () => {
    cancelRef.current++;
    queueRef.current = [];
    doneRef.current = null;
    abortRef.current?.abort();
    setProgress(0);
    reset();
  };

  /* --------------------------- target history --------------------------- */
  const onTargetKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void execute();
      return;
    }
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    if (targetHistory.length === 0) return;
    e.preventDefault();
    const next =
      e.key === "ArrowUp"
        ? Math.min(histIndex + 1, targetHistory.length - 1)
        : histIndex - 1;
    setHistIndex(next);
    setTarget(next < 0 ? "" : targetHistory[next]);
  };

  /* -------------------------------- export ------------------------------ */
  const exportLog = (ext: "log" | "txt") => {
    const lines = output
      .map(
        (o) =>
          `[${new Date(o.ts).toISOString()}] [${o.level.toUpperCase()}] ${o.line}`,
      )
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
    a.download = `reaper-${payload}-${Date.now()}.${ext}`;
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

  const scrollActive = !scrollLocked && autoScroll;

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
      <div className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
        {!minimal && (
          <header className="panel hover-glow flex flex-wrap items-center gap-4 px-4 py-3 sm:px-5">
            <Link
              to="/"
              className="hover-glow inline-flex items-center gap-2 rounded-md border border-border/60 bg-[color:var(--surface-2)] px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
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
        )}

        {/* Control bar */}
        <section className="panel grid grid-cols-1 gap-3 p-3 sm:p-4 md:grid-cols-[minmax(0,1fr)_260px_auto]">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Target · press ↑/↓ to recall
            </span>
            <input
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setHistIndex(-1);
              }}
              onKeyDown={onTargetKeyDown}
              placeholder="host.example.com or 10.0.0.4"
              disabled={isExecuting}
              className="hover-glow w-full rounded-md border border-border/60 bg-[color:var(--surface-2)] px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-[color:var(--cyan)]/60 focus:outline-none disabled:opacity-60"
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
              className="hover-glow w-full rounded-md border border-border/60 bg-[color:var(--surface-2)] px-3 py-2 font-mono text-sm text-foreground focus:border-[color:var(--cyan)]/60 focus:outline-none disabled:opacity-60"
            >
              {PAYLOADS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button
              onClick={execute}
              disabled={isExecuting || !target.trim()}
              className="inline-flex items-center gap-2 rounded-md border border-[color:var(--neon)]/50 bg-[color:var(--neon)]/10 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-[color:var(--neon)] glow-neon transition hover:bg-[color:var(--neon)]/20 disabled:cursor-not-allowed disabled:opacity-40"
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
              className="inline-flex items-center gap-2 rounded-md border border-[color:var(--danger)]/50 bg-[color:var(--danger)]/10 px-3 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-[color:var(--danger)] transition hover:bg-[color:var(--danger)]/20 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </button>
          </div>
        </section>

