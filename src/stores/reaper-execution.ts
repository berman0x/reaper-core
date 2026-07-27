import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OutputLevel } from "@/lib/payloads";

export type OutputLine = {
  id: number;
  line: string;
  level: OutputLevel;
  ts: number;
};

export type ExecStatus = "idle" | "executing" | "success" | "error" | "stopped";

export type HistoryEntry = {
  id: string;
  target: string;
  payload: string;
  startedAt: number;
  finishedAt: number;
  outcome: Exclude<ExecStatus, "idle" | "executing">;
  lineCount: number;
};

type State = {
  target: string;
  payload: string;
  output: OutputLine[];
  status: ExecStatus;
  currentExecId: string | null;
  startedAt: number | null;
  history: HistoryEntry[];
  targetHistory: string[];
  soundEnabled: boolean;
  setTarget: (t: string) => void;
  setPayload: (p: string) => void;
  appendLine: (line: string, level: OutputLevel) => void;
  beginLine: (level: OutputLevel) => void;
  growLine: (chars: string) => void;
  pushTargetHistory: (t: string) => void;
  toggleSound: () => void;
  reset: () => void;
  clearHistory: () => void;
  clearAll: () => void;
  beginExecution: (execId: string) => void;
  finishExecution: (outcome: HistoryEntry["outcome"]) => void;
};

let lineSeq = 0;

export const useExecutionStore = create<State>()(
  persist(
    (set, get) => ({
      target: "",
      payload: "recon.portscan",
      output: [],
      status: "idle",
      currentExecId: null,
      startedAt: null,
      history: [],
      targetHistory: [],
      soundEnabled: false,

      setTarget: (t) => set({ target: t }),
      setPayload: (p) => set({ payload: p }),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

      pushTargetHistory: (t) =>
        set((s) => ({
          targetHistory: [t, ...s.targetHistory.filter((x) => x !== t)].slice(0, 20),
        })),

      appendLine: (line, level) =>
        set((s) => ({
          output: [
            ...s.output,
            { id: ++lineSeq, line, level, ts: Date.now() },
          ].slice(-2000),
        })),

      // Typewriter support: open an empty line, then grow it character by character.
      beginLine: (level) =>
        set((s) => ({
          output: [
            ...s.output,
            { id: ++lineSeq, line: "", level, ts: Date.now() },
          ].slice(-2000),
        })),

      growLine: (chars) =>
        set((s) => {
          if (s.output.length === 0) return s;
          const out = s.output.slice();
          const last = out[out.length - 1];
          out[out.length - 1] = { ...last, line: last.line + chars };
          return { output: out };
        }),

      clearHistory: () => set({ history: [] }),


      reset: () =>
        set({
          output: [],
          status: "idle",
          currentExecId: null,
          startedAt: null,
        }),

      clearAll: () =>
        set({
          output: [],
          status: "idle",
          currentExecId: null,
          startedAt: null,
          history: [],
        }),

      beginExecution: (execId) =>
        set({
          output: [],
          status: "executing",
          currentExecId: execId,
          startedAt: Date.now(),
        }),

      finishExecution: (outcome) => {
        const s = get();
        if (!s.currentExecId || !s.startedAt) {
          set({ status: outcome });
          return;
        }
        const entry: HistoryEntry = {
          id: s.currentExecId,
          target: s.target,
          payload: s.payload,
          startedAt: s.startedAt,
          finishedAt: Date.now(),
          outcome,
          lineCount: s.output.length,
        };
        set({
          status: outcome,
          currentExecId: null,
          startedAt: null,
          history: [entry, ...s.history].slice(0, 10),
        });
      },
    }),
    {
      name: "reaper.execution",
      partialize: (s) => ({
        history: s.history,
        target: s.target,
        payload: s.payload,
        targetHistory: s.targetHistory,
        soundEnabled: s.soundEnabled,
      }),

    },
  ),
);
