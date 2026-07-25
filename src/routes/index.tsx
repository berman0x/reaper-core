import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  Bell,
  CircleDot,
  Cpu,
  Download,
  Gauge,
  Moon,
  Radio,
  ShieldCheck,
  Signal,
  Sun,
  Timer,
  WifiOff,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: ReaperDashboard,
  head: () => ({
    meta: [
      { title: "Reaper — Live Sensor Network Terminal" },
      {
        name: "description",
        content:
          "Real-time telemetry from the Reaper distributed sensor fleet: live node health, deployment queue, and performance stream.",
      },
      { property: "og:title", content: "Reaper — Live Sensor Network Terminal" },
      {
        property: "og:description",
        content:
          "Real-time telemetry from the Reaper distributed sensor fleet: live node health, deployment queue, and performance stream.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

/* ------------------------------ types ------------------------------ */

type NodeStatus = "online" | "offline" | "degraded";
type NodeRow = {
  id: string;
  region: string;
  status: NodeStatus;
  ping_ms: number | null;
  version: string;
  uptime_s: number;
  last_ping: string;
  updated_at: string;
};
type ActivityRow = {
  id: number;
  node_id: string | null;
  event_type: "deploy" | "info" | "warn" | "error";
  message: string;
  created_at: string;
};
type QueueRow = {
  id: string;
  label: string;
  progress: number;
  eta_seconds: number;
  state: string;
  updated_at: string;
};
type PerfRow = {
  id: number;
  sampled_at: string;
  success_rate: number;
  latency_ms: number;
};

type Conn = "connecting" | "live" | "offline";

/* ------------------------------ hooks ------------------------------ */

function useReaperTelemetry() {
  const [nodes, setNodes] = useState<NodeRow[] | null>(null);
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  const [queue, setQueue] = useState<QueueRow[] | null>(null);
  const [perf, setPerf] = useState<PerfRow[] | null>(null);
  const [conn, setConn] = useState<Conn>("connecting");
  const [updated, setUpdated] = useState<{
    nodes?: Date;
    activity?: Date;
    queue?: Date;
    perf?: Date;
  }>({});

  const stamp = useCallback((k: keyof typeof updated) => {
    setUpdated((u) => ({ ...u, [k]: new Date() }));
  }, []);

  const refetchAll = useCallback(async () => {
    const [n, a, q, p] = await Promise.all([
      supabase.from("reaper_nodes").select("*").order("id"),
      supabase
        .from("reaper_activity")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("reaper_queue")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("reaper_perf")
        .select("*")
        .order("sampled_at", { ascending: false })
        .limit(60),
    ]);
    if (!n.error) {
      setNodes((n.data as NodeRow[]) ?? []);
      stamp("nodes");
    }
    if (!a.error) {
      setActivity((a.data as ActivityRow[]) ?? []);
      stamp("activity");
    }
    if (!q.error) {
      setQueue((q.data as QueueRow[]) ?? []);
      stamp("queue");
    }
    if (!p.error) {
      setPerf(((p.data as PerfRow[]) ?? []).slice().reverse());
      stamp("perf");
    }
    return !(n.error || a.error || q.error || p.error);
  }, [stamp]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const connect = async () => {
      setConn("connecting");
      const ok = await refetchAll();
      if (cancelled) return;
      if (!ok) {
        setConn("offline");
        retryTimer = setTimeout(connect, 4000);
        return;
      }
      setConn("live");
      // Poll every 5s as a backstop against dropped realtime events
      pollTimer = setInterval(refetchAll, 5000);
    };

    connect();

    // Realtime subscriptions on all four tables
    const channel = supabase
      .channel("reaper-stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reaper_nodes" },
        () => {
          refetchAll();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reaper_activity" },
        (payload) => {
          setActivity((prev) => {
            const row = payload.new as ActivityRow;
            const next = [row, ...(prev ?? [])].slice(0, 60);
            return next;
          });
          stamp("activity");
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reaper_queue" },
        () => {
          refetchAll();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reaper_perf" },
        (payload) => {
          setPerf((prev) => {
            const row = payload.new as PerfRow;
            const next = [...(prev ?? []), row].slice(-60);
            return next;
          });
          stamp("perf");
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConn("live");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConn("offline");
      });

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (pollTimer) clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [refetchAll, stamp]);

  return { nodes, activity, queue, perf, conn, updated, refetchAll };
}

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const stored = (typeof window !== "undefined"
      ? window.localStorage.getItem("reaper-theme")
      : null) as "dark" | "light" | null;
    const initial = stored ?? "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("light", initial === "light");
  }, []);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("light", next === "light");
      try {
        window.localStorage.setItem("reaper-theme", next);
      } catch {}
      return next;
    });
  }, []);
  return { theme, toggle };
}

/* --------------------------------- ui ---------------------------------- */

function ReaperDashboard() {
  const { nodes, activity, queue, perf, conn, updated, refetchAll } =
    useReaperTelemetry();
  const { theme, toggle } = useTheme();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    if (!nodes) return null;
    const online = nodes.filter((n) => n.status === "online").length;
    const avgPing =
      Math.round(
        (nodes
          .filter((n) => n.ping_ms != null)
          .reduce((s, n) => s + (n.ping_ms ?? 0), 0) /
          Math.max(1, nodes.filter((n) => n.ping_ms != null).length)) || 0,
      ) || 0;
    return { active: online, total: nodes.length, avgPing };
  }, [nodes]);

  const successRate = useMemo(() => {
    if (!perf || perf.length === 0) return null;
    return perf[perf.length - 1].success_rate;
  }, [perf]);

  const perfStats = useMemo(() => {
    if (!perf || perf.length === 0) return null;
    const rates = perf.map((p) => Number(p.success_rate));
    const mean = rates.reduce((s, v) => s + v, 0) / rates.length;
    const variance =
      rates.reduce((s, v) => s + (v - mean) ** 2, 0) / rates.length;
    return {
      peak: Math.max(...rates).toFixed(1),
      low: Math.min(...rates).toFixed(1),
      mean: mean.toFixed(1),
      sigma: Math.sqrt(variance).toFixed(2),
    };
  }, [perf]);

  const perfSeries = useMemo(
    () =>
      (perf ?? []).map((p) => ({
        t: new Date(p.sampled_at).toISOString().slice(11, 16),
        success: Number(p.success_rate),
      })),
    [perf],
  );

  const exportSnapshot = useCallback(() => {
    const snapshot = {
      exported_at: new Date().toISOString(),
      last_updated: updated,
      stats,
      nodes,
      activity,
      queue,
      perf,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reaper-snapshot-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [activity, nodes, perf, queue, stats, updated]);

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
      <div className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <TopNav
          now={now}
          conn={conn}
          theme={theme}
          onToggleTheme={toggle}
          onExport={exportSnapshot}
          onRefresh={refetchAll}
        />

        {/* Metric cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Active Nodes"
            value={stats ? String(stats.active) : "—"}
            sub={stats ? `/ ${stats.total} online` : "waiting for data"}
            accent="neon"
            icon={<Cpu className="h-4 w-4" />}
          />
          <MetricCard
            label="Success Rate"
            value={successRate != null ? successRate.toFixed(1) : "—"}
            unit={successRate != null ? "%" : undefined}
            sub={perf ? `${perf.length} live samples` : "waiting for data"}
            accent="cyan"
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <MetricCard
            label="Avg Ping"
            value={stats && stats.avgPing > 0 ? String(stats.avgPing) : "—"}
            unit={stats && stats.avgPing > 0 ? "ms" : undefined}
            sub={stats ? `across ${stats.active} online nodes` : "waiting for data"}
            accent="gold"
            icon={<Gauge className="h-4 w-4" />}
          />
          <MetricCard
            label="Last Tick"
            value={now.toISOString().slice(11, 19)}
            sub={now.toISOString().slice(0, 10) + " UTC"}
            accent="neon"
            icon={<Timer className="h-4 w-4" />}
          />
        </section>

        {/* Middle: chart + node table */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="panel relative overflow-hidden p-5 xl:col-span-2">
            <PanelHeader
              eyebrow="TELEMETRY"
              title="Deployment Success Rate"
              meta={
                updated.perf
                  ? `updated ${relTime(updated.perf, now)}`
                  : "waiting for data"
              }
              dotColor="var(--neon)"
            />
            <div className="mt-4 h-[280px] w-full">
              {perf == null ? (
                <EmptyBlock label="Connecting to telemetry stream…" />
              ) : perfSeries.length === 0 ? (
                <EmptyBlock label="No performance samples yet." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={perfSeries}
                    margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="gNeon" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="var(--neon)"
                          stopOpacity={0.55}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--neon)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="color-mix(in oklab, var(--muted-foreground) 25%, transparent)"
                      strokeDasharray="3 6"
                    />
                    <XAxis
                      dataKey="t"
                      stroke="var(--muted-foreground)"
                      tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      domain={[75, 100]}
                      stroke="var(--muted-foreground)"
                      tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
                      tickLine={false}
                      axisLine={false}
                      unit="%"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontFamily: "JetBrains Mono",
                        fontSize: 12,
                        color: "var(--foreground)",
                      }}
                      labelStyle={{ color: "var(--neon)" }}
                      formatter={(v: number) => [`${Number(v).toFixed(2)}%`, "success"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="success"
                      stroke="var(--neon)"
                      strokeWidth={2}
                      fill="url(#gNeon)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {perfStats && (
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
                <MiniStat label="Peak" value={`${perfStats.peak}%`} accent="neon" />
                <MiniStat label="Low" value={`${perfStats.low}%`} accent="gold" />
                <MiniStat label="Mean" value={`${perfStats.mean}%`} accent="cyan" />
                <MiniStat label="σ" value={perfStats.sigma} accent="cyan" />
              </div>
            )}
          </div>

          <div className="panel flex flex-col overflow-hidden">
            <div className="p-5 pb-3">
              <PanelHeader
                eyebrow="FLEET"
                title="Node Health"
                meta={
                  nodes
                    ? `${nodes.length} nodes · ${
                        updated.nodes ? relTime(updated.nodes, now) : "—"
                      }`
                    : "waiting for data"
                }
                dotColor="var(--cyan)"
              />
            </div>
            <div className="max-h-[340px] overflow-auto">
              {nodes == null ? (
                <div className="px-5 py-8">
                  <EmptyBlock label="Connecting to fleet…" />
                </div>
              ) : nodes.length === 0 ? (
                <div className="px-5 py-8">
                  <EmptyBlock label="No active nodes" />
                </div>
              ) : (
                <table className="w-full text-left font-mono text-xs">
                  <thead className="sticky top-0 bg-[color:var(--surface)]/95 text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="px-5 py-2 font-medium">Node</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-2 py-2 font-medium">Ping</th>
                      <th className="px-2 py-2 font-medium">Uptime</th>
                      <th className="px-5 py-2 text-right font-medium">Payload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.map((n) => (
                      <tr
                        key={n.id}
                        className="group border-t border-border/60 transition-colors hover:bg-[color:var(--surface-2)]/70"
                      >
                        <td className="px-5 py-2.5">
                          <div className="text-foreground">{n.id}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {n.region}
                          </div>
                        </td>
                        <td className="px-2 py-2.5">
                          <StatusPill status={n.status} />
                        </td>
                        <td className="px-2 py-2.5 text-muted-foreground">
                          {n.ping_ms != null ? `${n.ping_ms}ms` : "—"}
                        </td>
                        <td className="px-2 py-2.5 text-muted-foreground">
                          {fmtUptime(n.uptime_s)}
                        </td>
                        <td className="px-5 py-2.5 text-right text-muted-foreground">
                          {n.version}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>

        {/* Bottom: activity + queue */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="panel flex flex-col p-5 xl:col-span-2">
            <PanelHeader
              eyebrow="STREAM"
              title="Activity Feed"
              meta={
                activity
                  ? `live · ${
                      updated.activity ? relTime(updated.activity, now) : "—"
                    }`
                  : "waiting for data"
              }
              dotColor="var(--neon)"
            />
            {activity == null ? (
              <div className="mt-4">
                <EmptyBlock label="Awaiting event stream…" />
              </div>
            ) : activity.length === 0 ? (
              <div className="mt-4">
                <EmptyBlock label="No events yet" />
              </div>
            ) : (
              <ol className="mt-4 max-h-[320px] space-y-1 overflow-auto pr-2 font-mono text-xs">
                {activity.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start gap-3 rounded px-2 py-1.5 transition-colors hover:bg-[color:var(--surface-2)]/60"
                  >
                    <span className="text-muted-foreground">
                      {new Date(e.created_at).toISOString().slice(11, 19)}
                    </span>
                    <EventTag type={e.event_type} />
                    <span className="flex-1 text-foreground/90">{e.message}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="panel flex flex-col p-5">
            <PanelHeader
              eyebrow="PIPELINE"
              title="Deployment Queue"
              meta={
                queue
                  ? `${queue.length} pending · ${
                      updated.queue ? relTime(updated.queue, now) : "—"
                    }`
                  : "waiting for data"
              }
              dotColor="var(--gold)"
            />
            {queue == null ? (
              <div className="mt-4">
                <EmptyBlock label="Awaiting pipeline…" />
              </div>
            ) : queue.length === 0 ? (
              <div className="mt-4">
                <EmptyBlock label="Queue empty" />
              </div>
            ) : (
              <ul className="mt-4 space-y-4">
                {queue.map((q) => (
                  <li key={q.id} className="group">
                    <div className="flex items-center justify-between gap-3 font-mono text-xs">
                      <div className="min-w-0">
                        <div className="truncate text-foreground">{q.label}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {q.id} · ETA {fmtEta(q.eta_seconds)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded border border-border p-1 text-muted-foreground transition-colors hover:border-[color:var(--danger)] hover:text-[color:var(--danger)]"
                        aria-label={`Cancel ${q.id}`}
                        title="Cancel (read-only)"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                      <div
                        className="h-full rounded-full transition-[width] duration-700 ease-out"
                        style={{
                          width: `${q.progress}%`,
                          background:
                            "linear-gradient(90deg, var(--gold), var(--neon))",
                          boxShadow:
                            "0 0 12px -2px color-mix(in oklab, var(--neon) 60%, transparent)",
                        }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                      <span>{q.progress}%</span>
                      <span>{q.state}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 pb-2 pt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>REAPER // TERMINAL v7.3.1 · LIVE FEED</span>
          <span>© {now.getUTCFullYear()} SECRSCH LAB</span>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------ subcomponents ---------------------------- */

function TopNav({
  now,
  conn,
  theme,
  onToggleTheme,
  onExport,
  onRefresh,
}: {
  now: Date;
  conn: Conn;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onExport: () => void;
  onRefresh: () => void;
}) {
  return (
    <header className="panel relative flex flex-wrap items-center gap-4 px-4 py-3 sm:px-5">
      <div className="flex items-center gap-3">
        <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[color:var(--neon)]/40 bg-[color:var(--surface-2)] glow-neon">
          <Radio className="h-4 w-4 text-[color:var(--neon)]" />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-sm font-semibold tracking-[0.3em] text-foreground">
            REAPER
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Sensor Network Terminal
          </div>
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
        <ConnectionBadge conn={conn} />
        <div className="hidden font-mono text-xs text-muted-foreground md:block">
          <span className="text-[color:var(--cyan)]">SYS</span>{" "}
          {now.toISOString().replace("T", " ").slice(0, 19)} UTC
        </div>
        <IconButton
          label="Refresh telemetry"
          onClick={onRefresh}
          accent="cyan"
        >
          <Signal className="h-4 w-4" />
        </IconButton>
        <IconButton
          label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={onToggleTheme}
          accent="gold"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </IconButton>
        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-1.5 rounded-md border border-[color:var(--neon)]/40 bg-[color:var(--surface-2)] px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-[color:var(--neon)] transition-colors hover:bg-[color:var(--neon)]/10"
        >
          <Download className="h-3.5 w-3.5" />
          Export Snapshot
        </button>
        <IconButton label="Notifications" accent="gold">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] pulse-dot" />
        </IconButton>
      </div>
    </header>
  );
}

function IconButton({
  children,
  label,
  onClick,
  accent = "cyan",
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  accent?: "cyan" | "gold" | "neon";
}) {
  const color = `var(--${accent})`;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="relative grid h-9 w-9 place-items-center rounded-md border border-border bg-[color:var(--surface-2)] text-muted-foreground transition-colors hover:text-[color:var(--foreground)]"
      style={{ borderColor: undefined }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
    >
      {children}
    </button>
  );
}

function ConnectionBadge({ conn }: { conn: Conn }) {
  const cfg =
    conn === "live"
      ? { c: "var(--neon)", label: "LIVE" }
      : conn === "connecting"
        ? { c: "var(--gold)", label: "CONNECTING" }
        : { c: "var(--danger)", label: "OFFLINE" };
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-widest"
      style={{
        borderColor: `color-mix(in oklab, ${cfg.c} 45%, transparent)`,
        color: cfg.c,
        background: `color-mix(in oklab, ${cfg.c} 10%, transparent)`,
      }}
    >
      {conn === "offline" ? (
        <WifiOff className="h-3 w-3" />
      ) : (
        <span className="relative flex h-2 w-2">
          <span
            className="absolute inset-0 rounded-full pulse-dot"
            style={{ background: cfg.c }}
          />
          <span
            className="relative h-2 w-2 rounded-full"
            style={{ background: cfg.c }}
          />
        </span>
      )}
      {cfg.label}
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent: "neon" | "cyan" | "gold";
  icon: React.ReactNode;
}) {
  const color = `var(--${accent})`;
  return (
    <div className="panel group relative overflow-hidden p-4">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-40 blur-2xl transition-opacity group-hover:opacity-70"
        style={{ background: color }}
      />
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span style={{ color }}>{icon}</span>
          {label}
        </span>
        <Signal className="h-3 w-3 opacity-50" />
      </div>
      <div className="mt-3 flex items-baseline gap-1 font-mono">
        <span
          className="text-3xl font-semibold tracking-tight"
          style={{
            color,
            textShadow: `0 0 22px color-mix(in oklab, ${color} 40%, transparent)`,
          }}
        >
          {value}
        </span>
        {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
      </div>
      {sub ? (
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "neon" | "cyan" | "gold";
}) {
  const color = `var(--${accent})`;
  return (
    <div className="flex flex-col gap-0.5 font-mono">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-sm" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function PanelHeader({
  eyebrow,
  title,
  meta,
  dotColor,
}: {
  eyebrow: string;
  title: string;
  meta?: string;
  dotColor?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {dotColor ? (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full pulse-dot"
              style={{ background: dotColor }}
            />
          ) : null}
          {eyebrow}
        </div>
        <h2 className="mt-1 truncate font-mono text-base font-semibold text-foreground">
          {title}
        </h2>
      </div>
      {meta ? (
        <div className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {meta}
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: NodeStatus }) {
  const map: Record<NodeStatus, { c: string; label: string }> = {
    online: { c: "var(--neon)", label: "ONLINE" },
    offline: { c: "var(--danger)", label: "OFFLINE" },
    degraded: { c: "var(--warn)", label: "DEGRADED" },
  };
  const { c, label } = map[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] tracking-widest"
      style={{
        borderColor: `color-mix(in oklab, ${c} 45%, transparent)`,
        color: c,
        background: `color-mix(in oklab, ${c} 8%, transparent)`,
      }}
    >
      <CircleDot className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function EventTag({ type }: { type: string }) {
  const map: Record<string, string> = {
    deploy: "var(--neon)",
    info: "var(--cyan)",
    warn: "var(--gold)",
    error: "var(--danger)",
  };
  const c = map[type] ?? "var(--muted-foreground)";
  return (
    <span
      className="w-14 shrink-0 rounded-sm border px-1 text-center text-[10px] uppercase tracking-widest"
      style={{
        borderColor: `color-mix(in oklab, ${c} 40%, transparent)`,
        color: c,
        background: `color-mix(in oklab, ${c} 8%, transparent)`,
      }}
    >
      {type}
    </span>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="grid h-full min-h-[120px] w-full place-items-center rounded-md border border-dashed border-border/70 bg-[color:var(--surface-2)]/30 p-6 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
      {label}
    </div>
  );
}

/* ------------------------------ formatters ---------------------------- */

function fmtUptime(s: number): string {
  if (!s) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtEta(s: number): string {
  if (s <= 0) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function relTime(then: Date, now: Date): string {
  const diff = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
