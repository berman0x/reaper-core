import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Boxes,
  Database,
  FileText,
  Gauge,
  Layers,
  LayoutDashboard,
  Radio,
  Settings as SettingsIcon,
  Shield,
  Terminal as TerminalIcon,
  Zap,
} from "lucide-react";
import { MODULES } from "@/config/modules";
import { useWebSocket, type ModuleState } from "@/hooks/useWebSocket";

export const Route = createFileRoute("/")({
  component: ReaperOpsCenter,
  head: () => ({
    meta: [
      { title: "Reaper // Recon Supply Chain" },
      {
        name: "description",
        content:
          "Reaper live ops center — orchestrate recon modules as a supply-chain pipeline with real-time WebSocket telemetry.",
      },
      { property: "og:title", content: "Reaper // Recon Supply Chain" },
      {
        property: "og:description",
        content: "Live pipeline orchestration for security recon modules with real-time streaming feed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/" as const },
  { icon: Boxes, label: "Assets", to: "/" as const },
  { icon: Layers, label: "Playbooks", to: "/monitor" as const },
  { icon: TerminalIcon, label: "Terminal", to: "/terminal" as const },
  { icon: FileText, label: "Reports", to: "/" as const },
  { icon: SettingsIcon, label: "Settings", to: "/" as const },
];

// Pick the first six modules for the pipeline visualization row.
const PIPELINE = MODULES.slice(0, 6);

const MODULE_ICONS: Record<string, string> = {
  scan: "SCAN",
  enum: "ENUM",
  detect: "DTCT",
  inspect: "INSP",
  monitor: "MON",
  report: "RPT",
  "dns-telemetry": "DNS",
  "host-posture-check": "HOST",
  "ssh-key-inventory": "SSH",
};

function shortLabel(id: string) {
  return MODULE_ICONS[id] ?? id.slice(0, 4).toUpperCase();
}

function statusMeta(state?: ModuleState) {
  const s = state?.status ?? "idle";
  switch (s) {
    case "running":
      return { label: "PROCESSING", color: "#00ff88", border: "border-[#00ff88]", text: "text-[#00ff88]" };
    case "success":
      return { label: "COMPLETE", color: "#00ff88", border: "border-[#00ff88]/60", text: "text-[#00ff88]" };
    case "error":
      return { label: "FAILED", color: "#ff9900", border: "border-[#ff9900]", text: "text-[#ff9900]" };
    case "waiting":
      return { label: "QUEUED", color: "#71717a", border: "border-zinc-700", text: "text-zinc-500" };
    default:
      return { label: "IDLE", color: "#3f3f46", border: "border-zinc-800", text: "text-zinc-600" };
  }
}

function useUptime() {
  const [now, setNow] = useState<number | null>(null);
  const startRef = useRef<number>(Date.now());
  useEffect(() => {
    startRef.current = Date.now();
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (now === null) return "00:00:00";
  const s = Math.floor((now - startRef.current) / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function ReaperOpsCenter() {
  const {
    status,
    lines,
    activeJobs,
    lastError,
    url,
    moduleStates,
    send,
    awaitJob,
    resetModules,
    markWaiting,
  } = useWebSocket();

  const [target, setTarget] = useState("scanme.nmap.org");
  const [isRunning, setIsRunning] = useState(false);
  const stopRef = useRef(false);
  const uptime = useUptime();

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

  const findings = useMemo(
    () =>
      lines
        .filter((l) => l.level === "warn" || l.level === "error" || l.level === "success")
        .slice(-6)
        .reverse(),
    [lines],
  );

  const runChain = async () => {
    if (!target.trim() || status !== "open") return;
    stopRef.current = false;
    resetModules();
    markWaiting(MODULES.map((m) => m.id), target.trim());
    setIsRunning(true);
    for (const mod of MODULES) {
      if (stopRef.current) break;
      const jobId = `${mod.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      send({ type: "execute", jobId, module: mod.module, target: target.trim() });
      await awaitJob(jobId);
    }
    setIsRunning(false);
  };

  const stopChain = () => {
    stopRef.current = true;
    send({ type: "stop" });
    setIsRunning(false);
  };

  const runSingle = (id: string) => {
    const mod = MODULES.find((m) => m.id === id);
    if (!mod || !target.trim() || status !== "open") return;
    const jobId = `${mod.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    send({ type: "execute", jobId, module: mod.module, target: target.trim() });
  };

  const sysStatus =
    status === "open"
      ? { label: "NOMINAL", color: "text-[#00ff88]" }
      : status === "connecting"
        ? { label: "LINKING", color: "text-[#ff9900]" }
        : { label: "OFFLINE", color: "text-red-500" };

  // Compute pipeline SVG connectors (dashed line between adjacent nodes)
  const pipeConnectorColor = (i: number) => {
    const a = moduleStates[PIPELINE[i].id]?.status;
    const b = moduleStates[PIPELINE[i + 1].id]?.status;
    if (a === "success" && (b === "success" || b === "running")) return "#00ff88";
    if (a === "running" || b === "running") return "#ff9900";
    return "#333";
  };

  return (
    <div className="w-full min-h-screen bg-[#0a0a0a] text-zinc-400 flex overflow-hidden selection:bg-[#ff9900] selection:text-black" style={{ fontFamily: "Work Sans, ui-sans-serif, system-ui" }}>
      {/* Left Sidebar */}
      <aside className="w-14 bg-[#111] border-r border-white/5 flex flex-col items-center py-5 gap-6 shrink-0">
        <div className="w-9 h-9 rounded-sm border border-[#ff9900] flex items-center justify-center text-[#ff9900] font-bold" style={{ fontFamily: "JetBrains Mono, ui-monospace, monospace" }}>
          R
        </div>
        <nav className="flex flex-col gap-4 text-zinc-600">
          {NAV.map((n, i) => {
            const Icon = n.icon;
            const active = i === 0;
            return (
              <Link
                key={n.label}
                to={n.to}
                title={n.label}
                className={`p-1.5 rounded-sm transition-colors ${
                  active ? "text-[#ff9900] bg-[#ff9900]/5" : "hover:text-[#00ff88]"
                }`}
              >
                <Icon className="w-4 h-4" />
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col items-center gap-2 text-[8px] text-zinc-700" style={{ fontFamily: "JetBrains Mono" }}>
          <Radio className={`w-3 h-3 ${status === "open" ? "text-[#00ff88] animate-pulse" : "text-zinc-700"}`} />
          <div className="rotate-180 [writing-mode:vertical-rl] uppercase tracking-widest">reaper_v2</div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0" style={{ fontFamily: "JetBrains Mono, ui-monospace, monospace" }}>
        {/* Top KPI Ticker */}
        <header className="h-7 bg-[#111] border-b border-white/5 flex items-center px-4 overflow-hidden gap-8 shrink-0">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-[9px] uppercase tracking-tighter text-zinc-500">SYS_STATUS:</span>
            <span className={`text-[9px] ${sysStatus.color}`}>{sysStatus.label}</span>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden flex-1 min-w-0">
            <span className="text-[9px] uppercase tracking-tighter text-zinc-500">CHANNEL:</span>
            <span className="text-[9px] text-[#ff9900] truncate">{url}</span>
            <span className="text-[9px] uppercase tracking-tighter text-zinc-500 ml-4">ACTIVE_JOBS:</span>
            <span className="text-[9px] text-[#00ff88]">{String(activeJobs).padStart(2, "0")}</span>
            <span className="text-[9px] uppercase tracking-tighter text-zinc-500 ml-4">CHAIN:</span>
            <span className="text-[9px] text-zinc-300">{completed}/{MODULES.length}</span>
          </div>
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <span className="text-[9px] text-zinc-500">Uptime: {uptime}</span>
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex-1 grid grid-cols-12 grid-rows-6 gap-1 p-1 min-h-0 overflow-hidden">
          {/* Mission Control */}
          <section className="col-span-3 row-span-1 bg-[#111] p-3 border border-white/5 flex flex-col justify-between min-h-0">
            <h2 className="text-[10px] uppercase text-[#ff9900] flex justify-between">
              <span>Mission Control</span>
              <span className="text-[8px] text-zinc-600">ID: RP-992</span>
            </h2>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="TARGET_HOST"
                className="flex-1 min-w-0 bg-black border border-white/10 px-2 py-1 text-xs focus:outline-none focus:border-[#ff9900] text-[#00ff88] placeholder:text-zinc-700"
              />
              {isRunning ? (
                <button
                  onClick={stopChain}
                  className="bg-red-600 text-black text-[10px] font-bold px-3 uppercase hover:bg-red-500"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={runChain}
                  disabled={status !== "open" || !target.trim()}
                  className="bg-[#ff9900] text-black text-[10px] font-bold px-3 uppercase hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Execute
                </button>
              )}
            </div>
          </section>

          {/* Pipeline Orchestration */}
          <section className="col-span-9 row-span-2 bg-[#111] border border-white/5 p-4 relative overflow-hidden min-h-0">
            <div className="absolute top-2 left-4 text-[10px] uppercase text-zinc-500">
              Pipeline Orchestration · Supply Chain
            </div>
            <div className="absolute top-2 right-4 text-[9px] uppercase text-zinc-600">
              {isRunning ? <span className="text-[#00ff88]">▶ CHAIN LIVE</span> : "IDLE"}
            </div>
            <div className="h-full w-full flex items-center justify-between px-2 relative pt-4">
              {/* dashed connectors between nodes */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {PIPELINE.slice(0, -1).map((_, i) => {
                  const step = 100 / PIPELINE.length;
                  const x1 = `${step * (i + 1) - step / 2 + 6}%`;
                  const x2 = `${step * (i + 1) + step / 2 - 6}%`;
                  return (
                    <line
                      key={i}
                      x1={x1}
                      x2={x2}
                      y1="50%"
                      y2="50%"
                      stroke={pipeConnectorColor(i)}
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />
                  );
                })}
              </svg>

              {PIPELINE.map((mod) => {
                const st = moduleStates[mod.id];
                const meta = statusMeta(st);
                const running = st?.status === "running";
                const done = st?.status === "success";
                const err = st?.status === "error";
                return (
                  <button
                    key={mod.id}
                    onClick={() => runSingle(mod.id)}
                    className="flex flex-col items-center gap-2 relative z-10 group"
                  >
                    <div
                      className={`w-20 h-20 bg-black border ${meta.border} ${
                        running ? "shadow-[0_0_12px_rgba(0,255,136,0.25)]" : ""
                      } ${err ? "shadow-[0_0_12px_rgba(255,153,0,0.25)]" : ""} flex flex-col items-center justify-center p-2 transition-colors group-hover:border-white/60`}
                    >
                      <div className={`${meta.text} mb-1 ${running ? "animate-pulse" : ""}`}>
                        <Zap className="w-4 h-4" />
                      </div>
                      <span className="text-[9px]">{shortLabel(mod.id)}</span>
                      <div className="w-full h-1 bg-zinc-900 mt-2 relative overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${done ? 100 : st?.progress ?? 0}%`,
                            background: meta.color,
                          }}
                        />
                        {running && (
                          <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite] translate-x-[-100%]" />
                        )}
                      </div>
                    </div>
                    <span className={`text-[8px] uppercase tracking-widest ${meta.text}`}>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Module Manifest */}
          <section className="col-span-3 row-span-5 bg-[#111] border border-white/5 flex flex-col min-h-0">
            <div className="p-2 border-b border-white/5 text-[10px] uppercase flex justify-between shrink-0">
              <span className="text-zinc-400">Module Manifest</span>
              <span className={isRunning ? "text-[#00ff88]" : "text-zinc-600"}>
                AUTO_CHAIN: {isRunning ? "ON" : "OFF"}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
              {MODULES.map((mod) => {
                const st = moduleStates[mod.id];
                const meta = statusMeta(st);
                const active = st?.status === "running" || st?.status === "error";
                return (
                  <button
                    key={mod.id}
                    onClick={() => runSingle(mod.id)}
                    className={`w-full text-left p-2 bg-black border ${
                      active ? meta.border : "border-white/5"
                    } flex flex-col gap-1 hover:border-white/30`}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[10px] font-bold text-zinc-300 truncate">
                        {mod.name.toUpperCase().replace(/\s+/g, "_")}
                      </span>
                      <span className={`text-[8px] px-1 border ${meta.border} ${meta.text} shrink-0`}>
                        {meta.label}
                      </span>
                    </div>
                    {st?.progress ? (
                      <div className="w-full bg-zinc-900 h-0.5">
                        <div
                          className="h-full transition-all"
                          style={{ width: `${st.progress}%`, background: meta.color }}
                        />
                      </div>
                    ) : null}
                    {st?.lastLine && (
                      <div className={`text-[8px] truncate ${meta.text}`}>{st.lastLine}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Live Terminal */}
          <section className="col-span-6 row-span-3 bg-black border border-white/5 p-2 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 pb-1 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${status === "open" ? "bg-[#00ff88] animate-pulse" : "bg-zinc-700"}`} />
                <span className="text-[9px] uppercase tracking-widest text-zinc-500">Terminal_Log</span>
              </div>
              <span className="text-[9px] text-zinc-700 truncate ml-2">STREAMING VIA {url}</span>
            </div>
            <div ref={termRef} className="flex-1 overflow-y-auto text-[10px] leading-tight space-y-0.5 min-h-0">
              {lines.length === 0 ? (
                <div className="text-zinc-700 italic">
                  waiting for pipeline output — enter target and execute the chain…
                </div>
              ) : (
                lines.map((l) => (
                  <div key={l.id} className="whitespace-pre-wrap break-words">
                    <span className="text-zinc-700">
                      [{new Date(l.ts).toLocaleTimeString()}]
                    </span>{" "}
                    <span className={levelClass(l.level)}>{l.text}</span>
                  </div>
                ))
              )}
              {isRunning && (
                <span className="inline-block w-1.5 h-3 bg-zinc-500 ml-1 animate-pulse align-middle" />
              )}
            </div>
            {lastError && (
              <div className="mt-1 text-[9px] text-red-400 border-t border-red-900/40 pt-1 shrink-0">
                {lastError}
              </div>
            )}
          </section>

          {/* Live Discoveries */}
          <section className="col-span-3 row-span-3 bg-[#111] border border-white/5 flex flex-col min-h-0">
            <div className="p-2 border-b border-white/5 text-[10px] uppercase text-[#00ff88] flex items-center justify-between shrink-0">
              <span>Live Discoveries</span>
              <Shield className="w-3 h-3" />
            </div>
            <div className="p-2 space-y-2 overflow-y-auto min-h-0 flex-1">
              {findings.length === 0 ? (
                <div className="text-[9px] text-zinc-700 italic">no discoveries yet.</div>
              ) : (
                findings.map((f) => {
                  const color =
                    f.level === "error"
                      ? "#ff9900"
                      : f.level === "warn"
                        ? "#ff9900"
                        : "#00ff88";
                  const label =
                    f.level === "error" ? "CRITICAL" : f.level === "warn" ? "WARNING" : "SUCCESS";
                  return (
                    <div
                      key={f.id}
                      className="border-l-2 p-2 bg-black"
                      style={{ borderLeftColor: color }}
                    >
                      <div className="flex justify-between text-[9px] uppercase">
                        <span style={{ color }}>{label}</span>
                        {f.module && <span className="text-zinc-600">{f.module}</span>}
                      </div>
                      <div className="text-[10px] text-white mt-0.5 break-words">{f.text}</div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* KPI Strip */}
          <section className="col-span-9 row-span-1 bg-[#111] border border-white/5 grid grid-cols-4 divide-x divide-white/5 min-h-0">
            <KpiCell
              icon={<Activity className="w-3 h-3" />}
              label="Scan Stream"
              value={`${lines.length}`}
              hint="lines"
              color="text-[#00ff88]"
            />
            <KpiCell
              icon={<Gauge className="w-3 h-3" />}
              label="Chain Progress"
              value={`${completed}/${MODULES.length}`}
              hint={`${Math.round((completed / MODULES.length) * 100)}%`}
              color="text-[#ff9900]"
            />
            <KpiCell
              icon={<Database className="w-3 h-3" />}
              label="Active Jobs"
              value={String(activeJobs).padStart(2, "0")}
              hint="live"
              color="text-white"
            />
            <KpiCell
              icon={<BarChart3 className="w-3 h-3" />}
              label="Findings"
              value={String(findings.length)}
              hint="warn+err"
              color="text-[#ff9900]"
            />
          </section>
        </div>
      </main>

      <style>{`@keyframes shimmer { 100% { transform: translateX(100%); } }`}</style>
    </div>
  );
}

function KpiCell({
  icon,
  label,
  value,
  hint,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  color: string;
}) {
  return (
    <div className="p-2 flex flex-col justify-center gap-0.5">
      <span className="text-[8px] uppercase text-zinc-600 flex items-center gap-1">
        {icon} {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className={`text-sm ${color}`}>{value}</span>
        <span className="text-[8px] text-zinc-600 uppercase">{hint}</span>
      </div>
    </div>
  );
}

function levelClass(level: string) {
  switch (level) {
    case "success":
      return "text-[#00ff88]";
    case "error":
      return "text-red-400";
    case "warn":
      return "text-[#ff9900]";
    case "system":
      return "text-[#ff9900]/80";
    case "output":
      return "text-zinc-300";
    default:
      return "text-zinc-500";
  }
}
