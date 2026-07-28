import { useState } from "react";
import { Play, Eraser } from "lucide-react";
import type { ModuleConfig } from "@/config/modules";

type Props = {
  modules: ModuleConfig[];
  onRun: (module: string, payload: Record<string, string>) => void;
  disabled?: boolean;
};

export function ActionGrid({ modules, onRun, disabled }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {modules.map((m) => (
        <ActionCard key={m.id} module={m} onRun={onRun} disabled={disabled} />
      ))}
    </div>
  );
}

function ActionCard({
  module: m,
  onRun,
  disabled,
}: {
  module: ModuleConfig;
  onRun: Props["onRun"];
  disabled?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(m.fields.map((f) => [f.key, ""])),
  );

  const canRun =
    !disabled &&
    m.fields.every((f) => !f.required || values[f.key]?.trim().length);

  const run = () => {
    if (!canRun) return;
    const payload: Record<string, string> = {};
    for (const f of m.fields) {
      const v = values[f.key]?.trim();
      if (v) payload[f.key] = v;
    }
    onRun(m.module, payload);
  };

  const clear = () =>
    setValues(Object.fromEntries(m.fields.map((f) => [f.key, ""])));

  return (
    <div className="group rounded-md border border-white/10 bg-white/[0.02] p-3 font-mono text-xs transition hover:border-cyan-400/40 hover:bg-white/[0.04]">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">▸</span>
          <span className="text-sm font-semibold text-foreground">{m.name}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {m.module}
          </span>
        </div>
        {m.category && (
          <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {m.category}
          </span>
        )}
      </div>

      {m.description && (
        <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
          {m.description}
        </p>
      )}

      <div className="mb-3 space-y-2">
        {m.fields.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
              {f.label}
              {f.required && <span className="ml-1 text-cyan-400">*</span>}
            </span>
            <input
              type={f.type ?? "text"}
              value={values[f.key] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") run();
              }}
              className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-foreground placeholder-muted-foreground outline-none transition focus:border-cyan-400/60"
            />
          </label>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={!canRun}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-cyan-400/40 bg-cyan-400/10 px-2 py-1.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.02] disabled:text-muted-foreground"
        >
          <Play className="h-3 w-3" />
          Run
        </button>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center justify-center gap-1.5 rounded border border-white/10 bg-white/[0.02] px-2 py-1.5 text-xs text-muted-foreground transition hover:border-white/20 hover:text-foreground"
        >
          <Eraser className="h-3 w-3" />
          Clear
        </button>
      </div>
    </div>
  );
}
