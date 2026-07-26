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
  setTarget: (t: string) => void;
  setPayload: (p: string) => void;
  appendLine: (line: string, level: OutputLevel) => void;
  reset: () => void;
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

      setTarget: (t) => set({ target: t }),
      setPayload: (p) => set({ payload: p }),

      appendLine: (line, level) =>
        set((s) => ({
          output: [
            ...s.output,
            { id: ++lineSeq, line, level, ts: Date.now() },
          ].slice(-2000),
        })),

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
      }),
    },
  ),
);
