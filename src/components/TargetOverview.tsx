import { useEffect, useState } from "react";
import { Target, Timer, Activity, CheckCircle2 } from "lucide-react";

type Props = {
  target: string;
  onTargetChange: (v: string) => void;
  phase: string;
  completed: number;
  total: number;
  startedAt: number | null;
  isRunning: boolean;
  onRunChain: () => void;
  onStop: () => void;
  disabled?: boolean;
};

function fmtElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function TargetOverview({
  target,
  onTargetChange,
  phase,
  completed,
  total,
  startedAt,
  isRunning,
  onRunChain,
  onStop,
  disabled,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt || !isRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [startedAt, isRunning]);

  const elapsed = startedAt ? (isRunning ? now : (startedAt ?? 0)) - startedAt : 0;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <section className="grid grid-cols-1 gap-3 rounded-md border border-white/10 bg-black/40 p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 shrink-0 text-cyan-300" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</div>
          <input
            value={target}
            onChange={(e) => onTargetChange(e.target.value)}
            placeholder="example.com"
            className="w-full bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
            disabled={isRunning}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 shrink-0 text-amber-300" />
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Phase</div>
          <div className="text-sm font-semibold text-foreground">{phase}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Progress</div>
          <div className="flex items-center gap-2">
            <span className="tabular-nums text-sm font-semibold text-foreground">
              {completed}/{total}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full bg-emerald-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Timer className="h-4 w-4 shrink-0 text-cyan-300" />
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Elapsed</div>
          <div className="font-mono text-sm tabular-nums text-foreground">
            {startedAt ? fmtElapsed(elapsed) : "00:00"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {isRunning ? (
          <button
            onClick={onStop}
            className="rounded border border-rose-400/40 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-rose-300 transition hover:bg-rose-400/20"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={onRunChain}
            disabled={disabled || !target.trim()}
            className="rounded border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Run Auto-Chain
          </button>
        )}
      </div>
    </section>
  );
}
