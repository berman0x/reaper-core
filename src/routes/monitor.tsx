import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Boxes,
  BookOpen,
  FileText,
  Settings as SettingsIcon,
  Trash2,
  Download,
  Wifi,
  WifiOff,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { MODULES } from "@/config/modules";
import { useWebSocket, type TerminalLineLevel } from "@/hooks/useWebSocket";
import { ModuleCard } from "@/components/ModuleCard";
import { TargetOverview } from "@/components/TargetOverview";
import { SummaryPanel } from "@/components/SummaryPanel";

export const Route = createFileRoute("/monitor")({
  component: MonitorPage,
  head: () => ({
    meta: [
      { title: "Reaper // Live Ops Center" },
      { name: "description", content: "Live operations center with real-time module status, auto-chain execution, and streaming telemetry." },
      { property: "og:title", content: "Reaper // Live Ops Center" },
      { property: "og:description", content: "Live module status grid + auto-chain telemetry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Assets", icon: Boxes },
  { label: "Playbooks", icon: BookOpen },
  { label: "Reports", icon: FileText },
  { label: "Settings", icon: SettingsIcon },
];

// Phase mapping — front half of the chain = recon, tail = analysis + reporting.
function currentPhase(completed: number, total: number, isRunning: boolean) {
  if (!isRunning && completed === 0) return "Idle";
  if (!isRunning && completed >= total) return "Complete";
  const pct = total ? completed / total : 0;
  if (pct < 0.5) return "Reconnaissance";
  if (pct < 0.85) return "Analysis";
  return "Reporting";
}

function MonitorPage() {
  const {
    status,
    lines,
    activeJobs,
    lastError,
    url,
    moduleStates,
    send,
    clearLines,
    awaitJob,
    resetModules,
    markWaiting,
  } = useWebSocket();

  const [active, setActive] = useState("Dashboard");
  const [target, setTarget] = useState("scanme.nmap.org");
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const stopRef = useRef(false);

  const termRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = termRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const completed = useMemo(
    () =>
      MODULES.filter((m) => {
        const s = moduleStates[m.id]?.status;
        return s === "success" || s === "error";
      }).length,
    [moduleStates],
  );

  const phase = currentPhase(completed, MODULES.length, isRunning);

  const runChain = async () => {
    if (!target.trim()) return;
    stopRef.current = false;
    resetModules();
    markWaiting(MODULES.map((m) => m.id), target.trim());
    setStartedAt(Date.now());
    setIsRunning(true);

    for (const mod of MODULES) {
      if (stopRef.current) break;
      const jobId = `${mod.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      send({ type: "execute", jobId, module: mod.module, target: target.trim() });
      // Fallback: if the backend does not emit job_started, still transition to "running"
      // via the first output; awaitJob resolves on done/error.
      await awaitJob(jobId);
    }
    setIsRunning(false);
  };

  const stopChain = () => {
    stopRef.current = true;
    send({ type: "stop" });
    setIsRunning(false);
  };

  const runSingle = (mod: (typeof MODULES)[number]) => {
    if (!target.trim()) return;
    const jobId = `${mod.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    send({ type: "execute", jobId, module: mod.module, target: target.trim() });
  };

  const exportLog = () => {
    const text = lines
      .map((l) => `[${new Date(l.ts).toISOString()}] ${l.text}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reaper-monitor-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const statusPill = useMemo(() => {
    if (status === "open")
      return { icon: Wifi, label: "LIVE", cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" };
    if (status === "connecting")
      return { icon: Loader2, label: "CONNECTING", cls: "border-amber-400/40 bg-amber-400/10 text-amber-300 animate-pulse" };
    return { icon: WifiOff, label: "OFFLINE", cls: "border-rose-400/40 bg-rose-400/10 text-rose-300" };
  }, [status]);

  return (
    <div className="flex min-h-screen w-full bg-background font-mono text-foreground">
      {/* Sidebar */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-white/10 bg-black/40 md:flex">
        <div className="border-b border-white/10 px-4 py-4">
          <Link to="/" className="text-sm font-bold tracking-widest text-cyan-300">
            REAPER
          </Link>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            live ops center
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map((n) => {
            const Icon = n.icon;
            const isActive = active === n.label;
            return (
              <button
                key={n.label}
                onClick={() => setActive(n.label)}
                className={`flex w-full items-center gap-2 rounded px-3 py-2 text-xs transition ${
                  isActive
                    ? "border border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
                    : "border border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/[0.03] hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3 text-[10px] text-muted-foreground">
          <div className="truncate">ws: {url}</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold">{active}</div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {activeJobs} active job{activeJobs === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusPill.cls}`}
            >
              <statusPill.icon className="h-3 w-3" />
              {statusPill.label}
            </span>
            <Link
              to="/terminal"
              className="rounded border border-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground transition hover:border-cyan-400/40 hover:text-cyan-300"
            >
              Scripted Terminal →
            </Link>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <TargetOverview
            target={target}
            onTargetChange={setTarget}
            phase={phase}
            completed={completed}
            total={MODULES.length}
            startedAt={startedAt}
            isRunning={isRunning}
            onRunChain={runChain}
            onStop={stopChain}
            disabled={status !== "open"}
          />

          {status !== "open" && (
            <p className="text-[11px] text-amber-300">
              Backend offline — auto-chain messages will queue and flush on reconnect.
            </p>
          )}

          {/* Module status grid — primary view */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Modules
              </h2>
              <span className="text-[10px] text-muted-foreground">
                click a card to run individually
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {MODULES.map((m) => (
                <ModuleCard
                  key={m.id}
                  id={m.id}
                  name={m.name}
                  state={moduleStates[m.id]}
                  onClick={() => runSingle(m)}
                />
              ))}
            </div>
          </section>

          <SummaryPanel target={target} modules={MODULES} moduleStates={moduleStates} />

          {/* Terminal — secondary, collapsible */}
          <section className="flex min-w-0 flex-col rounded-md border border-white/10 bg-black/60">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <button
                onClick={() => setTerminalOpen((v) => !v)}
                className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-cyan-300"
              >
                {terminalOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                )}
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                terminal · {lines.length} line{lines.length === 1 ? "" : "s"}
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={exportLog}
                  className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-muted-foreground transition hover:border-cyan-400/40 hover:text-cyan-300"
                >
                  <Download className="h-3 w-3" /> Export
                </button>
                <button
                  onClick={clearLines}
                  className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-muted-foreground transition hover:border-rose-400/40 hover:text-rose-300"
                >
                  <Trash2 className="h-3 w-3" /> Clear
                </button>
              </div>
            </div>
            {terminalOpen && (
              <div
                ref={termRef}
                className="max-h-[320px] min-h-[180px] flex-1 overflow-y-auto p-3 text-[11px] leading-relaxed"
              >
                {lines.length === 0 ? (
                  <div className="text-muted-foreground">
                    no output yet — run the auto-chain or a single module.
                  </div>
                ) : (
                  lines.map((l) => (
                    <div key={l.id} className="whitespace-pre-wrap break-words">
                      <span className="mr-2 text-muted-foreground">
                        [{new Date(l.ts).toLocaleTimeString()}]
                      </span>
                      <span className={levelClass(l.level)}>{l.text}</span>
                    </div>
                  ))
                )}
              </div>
            )}
            {lastError && (
              <div className="border-t border-rose-400/20 bg-rose-400/5 px-3 py-1.5 text-[10px] text-rose-300">
                {lastError}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function levelClass(level: TerminalLineLevel) {
  switch (level) {
    case "success":
      return "text-emerald-300";
    case "error":
      return "text-rose-300";
    case "warn":
      return "text-amber-300";
    case "system":
      return "text-cyan-300";
    case "output":
      return "text-foreground/90";
    default:
      return "text-muted-foreground";
  }
}
