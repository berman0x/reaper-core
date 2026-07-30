import type { LucideIcon } from "lucide-react";
import {
  Server,
  ShieldCheck,
  Lock,
  Globe,
  Search,
  Radar,
  Activity,
  FileText,
  KeyRound,
  Boxes,
  CircleDot,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from "lucide-react";
import type { ModuleState } from "@/hooks/useWebSocket";

// Icon per known module id. Fallback = Boxes.
const MODULE_ICONS: Record<string, LucideIcon> = {
  scan: Server,
  enum: Search,
  detect: Radar,
  inspect: FileText,
  monitor: Activity,
  report: FileText,
  "dns-telemetry": Globe,
  "host-posture-check": ShieldCheck,
  "ssh-key-inventory": KeyRound,
  ssl: Lock,
  waf: ShieldCheck,
};

export function moduleIcon(id: string): LucideIcon {
  return MODULE_ICONS[id] ?? Boxes;
}

type Props = {
  id: string;
  name: string;
  state?: ModuleState;
  onClick?: () => void;
};

const STATUS_META = {
  idle: {
    label: "Waiting",
    color: "text-muted-foreground",
    ring: "border-white/10 bg-black/40",
    bar: "bg-muted",
    Icon: CircleDot,
  },
  waiting: {
    label: "Queued",
    color: "text-amber-300",
    ring: "border-amber-400/30 bg-amber-400/5",
    bar: "bg-amber-400/70",
    Icon: Clock,
  },
  running: {
    label: "Running",
    color: "text-amber-300",
    ring: "border-amber-400/40 bg-amber-400/10 shadow-[0_0_20px_-6px_rgba(251,191,36,0.4)]",
    bar: "bg-amber-400",
    Icon: Loader2,
  },
  success: {
    label: "Done",
    color: "text-emerald-300",
    ring: "border-emerald-400/40 bg-emerald-400/5 shadow-[0_0_20px_-6px_rgba(52,211,153,0.4)]",
    bar: "bg-emerald-400",
    Icon: CheckCircle2,
  },
  error: {
    label: "Failed",
    color: "text-rose-300",
    ring: "border-rose-400/40 bg-rose-400/5 shadow-[0_0_20px_-6px_rgba(251,113,133,0.4)]",
    bar: "bg-rose-400",
    Icon: XCircle,
  },
} as const;

function fmtDuration(ms?: number) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ModuleCard({ id, name, state, onClick }: Props) {
  const Icon = moduleIcon(id);
  const status = state?.status ?? "idle";
  const meta = STATUS_META[status];
  const StatusIcon = meta.Icon;
  const progress = state?.progress ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col gap-3 rounded-md border p-3 text-left transition hover:border-cyan-400/40 hover:shadow-[0_0_20px_-6px_rgba(34,211,238,0.4)] ${meta.ring}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="rounded border border-white/10 bg-black/50 p-1.5">
            <Icon className="h-3.5 w-3.5 text-cyan-300" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-foreground">{name}</div>
            <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
              {id}
            </div>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.color}`}
        >
          <StatusIcon
            className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`}
          />
          {meta.label}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className={`h-full transition-all duration-300 ${meta.bar}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="min-h-[2.25rem] rounded border border-white/5 bg-black/50 px-2 py-1.5 font-mono text-[10px] leading-snug text-muted-foreground">
        {state?.lastLine ? (
          <span className="line-clamp-2 break-words">{state.lastLine}</span>
        ) : (
          <span className="italic text-muted-foreground/60">no output</span>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{state?.lineCount ?? 0} lines</span>
        <span className="tabular-nums">{fmtDuration(state?.durationMs)}</span>
      </div>
    </button>
  );
}
