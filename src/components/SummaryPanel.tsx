import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, Award } from "lucide-react";
import type { ModuleState } from "@/hooks/useWebSocket";
import type { ModuleConfig } from "@/config/modules";

type Props = {
  target: string;
  modules: ModuleConfig[];
  moduleStates: Record<string, ModuleState>;
};

function computeGrade(states: ModuleState[]) {
  if (states.length === 0) return { grade: "—", pct: 0 };
  const ok = states.filter((s) => s.status === "success").length;
  const pct = Math.round((ok / states.length) * 100);
  const grade =
    pct >= 95 ? "A" : pct >= 85 ? "B" : pct >= 70 ? "C" : pct >= 55 ? "D" : "F";
  return { grade, pct };
}

const GRADE_COLOR: Record<string, string> = {
  A: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10",
  B: "text-emerald-300 border-emerald-400/40 bg-emerald-400/5",
  C: "text-amber-300 border-amber-400/40 bg-amber-400/10",
  D: "text-orange-300 border-orange-400/40 bg-orange-400/10",
  F: "text-rose-300 border-rose-400/40 bg-rose-400/10",
  "—": "text-muted-foreground border-white/10 bg-black/40",
};

export function SummaryPanel({ target, modules, moduleStates }: Props) {
  const [open, setOpen] = useState(true);

  const stateList = useMemo(
    () => modules.map((m) => ({ mod: m, state: moduleStates[m.id] })).filter((x) => x.state),
    [modules, moduleStates],
  );

  const allDone =
    stateList.length > 0 &&
    stateList.every((x) => x.state!.status === "success" || x.state!.status === "error");

  const { grade, pct } = computeGrade(stateList.map((x) => x.state!));

  const findings = stateList
    .filter((x) => x.state!.status === "error")
    .map((x) => `${x.mod.name}: ${x.state!.lastLine || "check failed"}`);

  const recommendations = useMemo(() => {
    const recs: string[] = [];
    if (findings.length) recs.push("Investigate failed modules and re-run against the target.");
    if (pct < 100 && pct >= 70) recs.push("Address partial failures to raise the grade.");
    if (pct < 70) recs.push("Coverage is low — review WebSocket connectivity and target reachability.");
    if (!recs.length) recs.push("All checks passed. Schedule periodic re-runs to detect drift.");
    return recs;
  }, [findings.length, pct]);

  const exportJson = () => {
    const payload = {
      target,
      generatedAt: new Date().toISOString(),
      grade,
      coverage: pct,
      modules: stateList.map((x) => ({
        id: x.mod.id,
        name: x.mod.name,
        status: x.state!.status,
        durationMs: x.state!.durationMs,
        lineCount: x.state!.lineCount,
        lastLine: x.state!.lastLine,
      })),
      findings,
      recommendations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reaper-summary-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!allDone) return null;

  return (
    <section className="rounded-md border border-white/10 bg-black/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Auto-Chain Summary
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-bold ${GRADE_COLOR[grade]}`}
          >
            <Award className="h-3 w-3" /> Grade {grade} · {pct}%
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            exportJson();
          }}
          className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground transition hover:border-cyan-400/40 hover:text-cyan-300"
        >
          <Download className="h-3 w-3" /> Export JSON
        </button>
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-4 border-t border-white/10 p-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-rose-300">
              Critical Findings
            </h3>
            {findings.length === 0 ? (
              <p className="text-xs text-muted-foreground">No critical findings.</p>
            ) : (
              <ul className="space-y-1 text-xs text-foreground/90">
                {findings.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-rose-300">▸</span>
                    <span className="break-words">{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-cyan-300">
              Recommendations
            </h3>
            <ul className="space-y-1 text-xs text-foreground/90">
              {recommendations.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-cyan-300">▸</span>
                  <span className="break-words">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
