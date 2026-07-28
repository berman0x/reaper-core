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
} from "lucide-react";
import { MODULES } from "@/config/modules";
import { ActionGrid } from "@/components/ActionGrid";
import { useWebSocket, type TerminalLineLevel } from "@/hooks/useWebSocket";

export const Route = createFileRoute("/monitor")({
  component: MonitorPage,
  head: () => ({
    meta: [
      { title: "Reaper // Monitor" },
      { name: "description", content: "Real-time WebSocket-driven monitor dashboard for the Reaper terminal." },
      { property: "og:title", content: "Reaper // Monitor" },
      { property: "og:description", content: "Real-time WebSocket monitor dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const NAV = [
  { label: "Dashboard", to: "/monitor", icon: LayoutDashboard },
  { label: "Assets", to: "/monitor", icon: Boxes },
  { label: "Playbooks", to: "/monitor", icon: BookOpen },
  { label: "Reports", to: "/monitor", icon: FileText },
  { label: "Settings", to: "/monitor", icon: SettingsIcon },
];

function MonitorPage() {
  const { status, lines, activeJobs, lastError, url, send, clearLines } =
    useWebSocket();

  const [active, setActive] = useState("Dashboard");

  const termRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = termRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const onRun = (module: string, payload: Record<string, string>) => {
    send({ type: "execute", module, ...payload });
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
      return {
        icon: Wifi,
        label: "LIVE",
        cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
      };
    if (status === "connecting")
      return {
        icon: Loader2,
        label: "CONNECTING",
        cls: "border-amber-400/40 bg-amber-400/10 text-amber-300 animate-pulse",
      };
    return {
      icon: WifiOff,
      label: "OFFLINE",
      cls: "border-rose-400/40 bg-rose-400/10 text-rose-300",
    };
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
            monitor terminal
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

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Action cards */}
          <section className="min-w-0">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Actions
              </h2>
              <span className="text-[10px] text-muted-foreground">
                {MODULES.length} module{MODULES.length === 1 ? "" : "s"}
              </span>
            </div>
            <ActionGrid
              modules={MODULES}
              onRun={onRun}
              disabled={status !== "open"}
            />
            {status !== "open" && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Not connected — messages will be queued and sent on reconnect.
              </p>
            )}
          </section>

          {/* Terminal */}
          <section className="flex min-h-[420px] min-w-0 flex-col rounded-md border border-white/10 bg-black/60">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                terminal · {lines.length} line{lines.length === 1 ? "" : "s"}
              </div>
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
            <div
              ref={termRef}
              className="min-h-0 flex-1 overflow-y-auto p-3 text-[11px] leading-relaxed"
            >
              {lines.length === 0 ? (
                <div className="text-muted-foreground">
                  no output yet — run an action to stream data here.
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
