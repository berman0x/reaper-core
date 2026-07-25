import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  Activity,
  Bell,
  CircleDot,
  Cpu,
  Gauge,
  Radio,
  ShieldCheck,
  Signal,
  Timer,
  X,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: ReaperDashboard,
});

/* ------------------------------ static data ------------------------------ */

const perfData = Array.from({ length: 24 }, (_, i) => {
  const base = 92 + Math.sin(i / 2) * 4 + (i % 5 === 0 ? -3 : 0);
  return {
    t: `${String(i).padStart(2, "0")}:00`,
    success: Math.max(78, Math.min(99.9, +(base + (Math.random() * 2 - 1)).toFixed(2))),
    latency: Math.round(120 + Math.sin(i / 3) * 30 + Math.random() * 20),
  };
});

type NodeStatus = "online" | "offline" | "degraded";
const nodes: {
  id: string;
  status: NodeStatus;
  ping: string;
  version: string;
  region: string;
}[] = [
  { id: "NODE-001", status: "online", ping: "12ms", version: "v7.3.1", region: "us-east" },
  { id: "NODE-002", status: "online", ping: "18ms", version: "v7.3.1", region: "us-west" },
  { id: "NODE-003", status: "degraded", ping: "412ms", version: "v7.2.9", region: "eu-central" },
  { id: "NODE-004", status: "offline", ping: "—", version: "v7.2.9", region: "ap-south" },
  { id: "NODE-005", status: "online", ping: "24ms", version: "v7.3.1", region: "sa-east" },
  { id: "NODE-006", status: "online", ping: "9ms", version: "v7.3.1", region: "us-east" },
  { id: "NODE-007", status: "degraded", ping: "298ms", version: "v7.3.0", region: "eu-west" },
  { id: "NODE-008", status: "online", ping: "31ms", version: "v7.3.1", region: "ap-northeast" },
];

const activity = [
  { t: "14:32:07", type: "deploy", msg: "Payload 7 completed on NODE-002" },
  { t: "14:31:44", type: "info", msg: "Node 12 registered — handshake OK" },
  { t: "14:30:18", type: "warn", msg: "NODE-003 latency exceeded 400ms threshold" },
  { t: "14:29:02", type: "error", msg: "Connection lost — NODE-004" },
  { t: "14:27:51", type: "deploy", msg: "Rolling deployment initiated (batch #219)" },
  { t: "14:26:33", type: "info", msg: "Telemetry checkpoint written (7.4MB)" },
  { t: "14:25:10", type: "deploy", msg: "Node 12 deployed — v7.3.1" },
  { t: "14:24:02", type: "info", msg: "Cert rotation completed for eu-central" },
  { t: "14:22:41", type: "warn", msg: "Queue depth > 24 on ap-south" },
  { t: "14:20:19", type: "info", msg: "Heartbeat sweep OK — 47/48 nodes" },
];

const queue = [
  { id: "TASK-8821", label: "Deploy v7.3.2 → us-east cluster", progress: 72, eta: "01:12" },
  { id: "TASK-8822", label: "Rotate signing keys → eu-central", progress: 44, eta: "03:40" },
  { id: "TASK-8823", label: "Telemetry backfill → NODE-004", progress: 21, eta: "07:55" },
  { id: "TASK-8824", label: "Canary rollout → ap-south (5%)", progress: 8, eta: "12:20" },
];

/* --------------------------------- ui ---------------------------------- */

function ReaperDashboard() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const online = nodes.filter((n) => n.status === "online").length;
    return {
      active: online,
      total: nodes.length,
      deployments: 1_284,
      avgMs: 142,
    };
  }, []);

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
      <div className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <TopNav now={now} />

        {/* Metric cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Active Nodes"
            value={`${stats.active}`}
            sub={`/ ${stats.total} online`}
            accent="neon"
            icon={<Cpu className="h-4 w-4" />}
          />
          <MetricCard
            label="Successful Deployments"
            value={stats.deployments.toLocaleString()}
            sub="last 30 days"
            accent="cyan"
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <MetricCard
            label="Avg Response Time"
            value={`${stats.avgMs}`}
            unit="ms"
            sub="↓ 6.2% vs. 24h"
            accent="gold"
            icon={<Gauge className="h-4 w-4" />}
          />
          <MetricCard
            label="Last Update"
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
              meta="24H · % success"
              dotColor="var(--neon)"
            />
            <div className="mt-4 h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={perfData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gNeon" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.88 0.24 142)" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="oklch(0.88 0.24 142)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="oklch(0.5 0.03 250 / 20%)" strokeDasharray="3 6" />
                  <XAxis
                    dataKey="t"
                    stroke="oklch(0.7 0.02 240)"
                    tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[75, 100]}
                    stroke="oklch(0.7 0.02 240)"
                    tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
                    tickLine={false}
                    axisLine={false}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.2 0.03 255)",
                      border: "1px solid oklch(0.4 0.04 250 / 60%)",
                      borderRadius: 8,
                      fontFamily: "JetBrains Mono",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "oklch(0.88 0.24 142)" }}
                    formatter={(v: number) => [`${v}%`, "success"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="success"
                    stroke="oklch(0.88 0.24 142)"
                    strokeWidth={2}
                    fill="url(#gNeon)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
              <MiniStat label="Peak" value="99.4%" accent="neon" />
              <MiniStat label="Low" value="83.1%" accent="gold" />
              <MiniStat label="Mean" value="93.7%" accent="cyan" />
              <MiniStat label="Variance" value="σ 3.2" accent="cyan" />
            </div>
          </div>

          <div className="panel flex flex-col overflow-hidden">
            <div className="p-5 pb-3">
              <PanelHeader
                eyebrow="FLEET"
                title="Node Health"
                meta={`${nodes.length} nodes`}
                dotColor="var(--cyan)"
              />
            </div>
            <div className="max-h-[340px] overflow-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="sticky top-0 bg-[color:var(--surface)]/95 text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-5 py-2 font-medium">Node</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Ping</th>
                    <th className="px-2 py-2 font-medium">Payload</th>
                    <th className="px-5 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((n) => (
                    <tr
                      key={n.id}
                      className="group cursor-pointer border-t border-border/60 transition-colors hover:bg-[color:var(--surface-2)]/70"
                    >
                      <td className="px-5 py-2.5">
                        <div className="text-foreground">{n.id}</div>
                        <div className="text-[10px] text-muted-foreground">{n.region}</div>
                      </td>
                      <td className="px-2 py-2.5">
                        <StatusPill status={n.status} />
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground">{n.ping}</td>
                      <td className="px-2 py-2.5 text-muted-foreground">{n.version}</td>
                      <td className="px-5 py-2.5 text-right">
                        <button
                          type="button"
                          className="rounded border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-[color:var(--cyan)] hover:text-[color:var(--cyan)]"
                        >
                          View Logs
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Bottom: activity + queue */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="panel flex flex-col p-5 xl:col-span-2">
            <PanelHeader
              eyebrow="STREAM"
              title="Activity Feed"
              meta="live · newest first"
              dotColor="var(--neon)"
            />
            <ol className="mt-4 max-h-[320px] space-y-1 overflow-auto pr-2 font-mono text-xs">
              {activity.map((e, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded px-2 py-1.5 transition-colors hover:bg-[color:var(--surface-2)]/60"
                >
                  <span className="text-muted-foreground">{e.t}</span>
                  <EventTag type={e.type} />
                  <span className="flex-1 text-foreground/90">{e.msg}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="panel flex flex-col p-5">
            <PanelHeader
              eyebrow="PIPELINE"
              title="Deployment Queue"
              meta={`${queue.length} pending`}
              dotColor="var(--gold)"
            />
            <ul className="mt-4 space-y-4">
              {queue.map((q) => (
                <li key={q.id} className="group">
                  <div className="flex items-center justify-between gap-3 font-mono text-xs">
                    <div className="min-w-0">
                      <div className="truncate text-foreground">{q.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {q.id} · ETA {q.eta}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded border border-border p-1 text-muted-foreground transition-colors hover:border-[color:var(--danger)] hover:text-[color:var(--danger)]"
                      aria-label={`Cancel ${q.id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${q.progress}%`,
                        background:
                          "linear-gradient(90deg, oklch(0.85 0.16 85), oklch(0.88 0.24 142))",
                        boxShadow:
                          "0 0 12px -2px color-mix(in oklab, oklch(0.88 0.24 142) 60%, transparent)",
                      }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                    <span>{q.progress}%</span>
                    <span>queued</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 pb-2 pt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>REAPER // TERMINAL v7.3.1 · DEMO DATA · NO EGRESS</span>
          <span>© {now.getUTCFullYear()} SECRSCH LAB</span>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------ subcomponents ---------------------------- */

function TopNav({ now }: { now: Date }) {
  return (
    <header className="panel relative flex items-center gap-4 px-4 py-3 sm:px-5">
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

      <div className="ml-auto flex items-center gap-3 sm:gap-5">
        <StatusIndicator />
        <div className="hidden font-mono text-xs text-muted-foreground sm:block">
          <span className="text-[color:var(--cyan)]">SYS</span>{" "}
          {now.toISOString().replace("T", " ").slice(0, 19)} UTC
        </div>
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-md border border-border bg-[color:var(--surface-2)] text-muted-foreground transition-colors hover:border-[color:var(--gold)] hover:text-[color:var(--gold)]"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] pulse-dot" />
        </button>
      </div>
    </header>
  );
}

function StatusIndicator() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[color:var(--neon)]/30 bg-[color:var(--surface-2)]/60 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-[color:var(--neon)]">
      <span className="relative flex h-2 w-2">
        <span className="absolute inset-0 rounded-full bg-[color:var(--neon)] pulse-dot" />
        <span className="relative rounded-full bg-[color:var(--neon)] h-2 w-2" />
      </span>
      Online
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
          style={{ color, textShadow: `0 0 22px color-mix(in oklab, ${color} 40%, transparent)` }}
        >
          {value}
        </span>
        {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
      </div>
      {sub ? (
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">{sub}</div>
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
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
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

// Suppress unused import warning; kept for potential extension.
void Activity;
