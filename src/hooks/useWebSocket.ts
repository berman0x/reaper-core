import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Generic streaming WebSocket hook for the Reaper monitor dashboard.
 *
 * Adds per-module status tracking on top of the raw line stream:
 *  - moduleStates: Record<moduleId, { status, progress, lastLine, durationMs, jobId }>
 *  - awaitJob(jobId): Promise that resolves when the job completes (or errors)
 *  - resetModules(): clear per-module state (e.g. before an auto-chain run)
 */

export type WSStatus = "connecting" | "open" | "closed" | "error";

export type TerminalLineLevel = "info" | "output" | "success" | "error" | "warn" | "system";

export type TerminalLine = {
  id: number;
  jobId?: string;
  module?: string;
  text: string;
  level: TerminalLineLevel;
  ts: number;
};

export type ModuleRunStatus = "idle" | "waiting" | "running" | "success" | "error";

export type ModuleState = {
  status: ModuleRunStatus;
  progress: number; // 0..100
  lastLine: string;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  jobId?: string;
  target?: string;
  lineCount: number;
};

type InboundEvent =
  | { type: "job_started"; jobId: string; module?: string; target?: string }
  | { type: "output"; jobId?: string; module?: string; line: string; level?: TerminalLineLevel; progress?: number }
  | { type: "done"; jobId: string; module?: string; status?: "success" | "error" | "stopped" }
  | { type: "error"; jobId?: string; module?: string; message: string };

type OutboundMessage = Record<string, unknown>;

export type UseWebSocketOptions = {
  url?: string;
  maxLines?: number;
  autoConnect?: boolean;
};

const DEFAULT_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ?? "ws://localhost:3000";

let lineSeq = 0;

const EMPTY_STATE: ModuleState = {
  status: "idle",
  progress: 0,
  lastLine: "",
  lineCount: 0,
};

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { url = DEFAULT_URL, maxLines = 2000, autoConnect = true } = options;

  const [status, setStatus] = useState<WSStatus>("closed");
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [activeJobs, setActiveJobs] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [moduleStates, setModuleStates] = useState<Record<string, ModuleState>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<OutboundMessage[]>([]);
  const retryRef = useRef(0);
  const reconnectTimer = useRef<number | null>(null);
  const manualCloseRef = useRef(false);
  const activeJobIds = useRef<Set<string>>(new Set());
  const jobToModule = useRef<Map<string, string>>(new Map());
  const jobWaiters = useRef<Map<string, (v: "success" | "error" | "stopped") => void>>(new Map());

  const patchModule = useCallback((moduleId: string, patch: Partial<ModuleState>) => {
    setModuleStates((prev) => {
      const current = prev[moduleId] ?? EMPTY_STATE;
      return { ...prev, [moduleId]: { ...current, ...patch } };
    });
  }, []);

  const pushLine = useCallback(
    (partial: Omit<TerminalLine, "id" | "ts"> & { ts?: number }) => {
      setLines((prev) => {
        const next = [
          ...prev,
          { ...partial, id: ++lineSeq, ts: partial.ts ?? Date.now() },
        ];
        return next.length > maxLines ? next.slice(-maxLines) : next;
      });
    },
    [maxLines],
  );

  const flushQueue = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    while (queueRef.current.length > 0) {
      const msg = queueRef.current.shift()!;
      try {
        ws.send(JSON.stringify(msg));
      } catch (err) {
        queueRef.current.unshift(msg);
        setLastError((err as Error).message);
        return;
      }
    }
  }, []);

  const send = useCallback((msg: OutboundMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(msg));
        return true;
      } catch (err) {
        setLastError((err as Error).message);
        return false;
      }
    }
    queueRef.current.push(msg);
    return false;
  }, []);

  const awaitJob = useCallback((jobId: string) => {
    return new Promise<"success" | "error" | "stopped">((resolve) => {
      jobWaiters.current.set(jobId, resolve);
    });
  }, []);

  const resolveWaiter = (jobId: string, outcome: "success" | "error" | "stopped") => {
    const w = jobWaiters.current.get(jobId);
    if (w) {
      w(outcome);
      jobWaiters.current.delete(jobId);
    }
  };

  const resetModules = useCallback(() => {
    setModuleStates({});
    jobToModule.current.clear();
  }, []);

  const markWaiting = useCallback(
    (moduleIds: string[], target?: string) => {
      setModuleStates((prev) => {
        const next = { ...prev };
        for (const id of moduleIds) {
          next[id] = { ...EMPTY_STATE, status: "waiting", target };
        }
        return next;
      });
    },
    [],
  );

  const handleEvent = useCallback(
    (ev: InboundEvent) => {
      switch (ev.type) {
        case "job_started": {
          activeJobIds.current.add(ev.jobId);
          setActiveJobs(activeJobIds.current.size);
          if (ev.module) {
            jobToModule.current.set(ev.jobId, ev.module);
            patchModule(ev.module, {
              status: "running",
              progress: 5,
              startedAt: Date.now(),
              endedAt: undefined,
              durationMs: undefined,
              jobId: ev.jobId,
              target: ev.target,
              lastLine: "",
              lineCount: 0,
            });
          }
          pushLine({
            jobId: ev.jobId,
            module: ev.module,
            level: "system",
            text: `▶ job ${ev.jobId} started${ev.module ? ` (${ev.module})` : ""}${ev.target ? ` → ${ev.target}` : ""}`,
          });
          break;
        }
        case "output": {
          const moduleId = ev.module ?? (ev.jobId ? jobToModule.current.get(ev.jobId) : undefined);
          if (moduleId) {
            setModuleStates((prev) => {
              const current = prev[moduleId] ?? EMPTY_STATE;
              const nextCount = current.lineCount + 1;
              const nextProgress =
                typeof ev.progress === "number"
                  ? Math.max(0, Math.min(100, ev.progress))
                  : Math.min(95, 10 + nextCount * 4);
              return {
                ...prev,
                [moduleId]: {
                  ...current,
                  status: "running",
                  progress: nextProgress,
                  lastLine: ev.line,
                  lineCount: nextCount,
                },
              };
            });
          }
          pushLine({
            jobId: ev.jobId,
            module: moduleId,
            level: ev.level ?? "output",
            text: ev.line,
          });
          break;
        }
        case "done": {
          if (activeJobIds.current.delete(ev.jobId)) {
            setActiveJobs(activeJobIds.current.size);
          }
          const moduleId = ev.module ?? jobToModule.current.get(ev.jobId);
          const outcome = ev.status ?? "success";
          if (moduleId) {
            setModuleStates((prev) => {
              const current = prev[moduleId] ?? EMPTY_STATE;
              const endedAt = Date.now();
              return {
                ...prev,
                [moduleId]: {
                  ...current,
                  status: outcome === "error" ? "error" : "success",
                  progress: 100,
                  endedAt,
                  durationMs: current.startedAt ? endedAt - current.startedAt : undefined,
                },
              };
            });
          }
          resolveWaiter(ev.jobId, outcome);
          pushLine({
            jobId: ev.jobId,
            module: moduleId,
            level: outcome === "error" ? "error" : "success",
            text: `■ job ${ev.jobId} ${outcome}`,
          });
          break;
        }
        case "error": {
          if (ev.jobId && activeJobIds.current.delete(ev.jobId)) {
            setActiveJobs(activeJobIds.current.size);
          }
          const moduleId = ev.module ?? (ev.jobId ? jobToModule.current.get(ev.jobId) : undefined);
          if (moduleId) {
            patchModule(moduleId, {
              status: "error",
              lastLine: ev.message,
              endedAt: Date.now(),
            });
          }
          if (ev.jobId) resolveWaiter(ev.jobId, "error");
          setLastError(ev.message);
          pushLine({
            jobId: ev.jobId,
            module: moduleId,
            level: "error",
            text: `✗ ${ev.message}`,
          });
          break;
        }
      }
    },
    [patchModule, pushLine],
  );

  const scheduleReconnect = useCallback(() => {
    if (manualCloseRef.current) return;
    const attempt = retryRef.current++;
    const delay = Math.min(30_000, 500 * Math.pow(2, attempt)) + Math.random() * 250;
    if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
    reconnectTimer.current = window.setTimeout(() => {
      connect();
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(() => {
    manualCloseRef.current = false;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

    setStatus("connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      setStatus("error");
      setLastError((err as Error).message);
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      setStatus("open");
      setLastError(null);
      pushLine({ level: "system", text: `✓ connected to ${url}` });
      flushQueue();
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data as string) as InboundEvent;
        handleEvent(data);
      } catch {
        pushLine({ level: "output", text: String(msg.data) });
      }
    };

    ws.onerror = () => {
      setStatus("error");
      setLastError("WebSocket error");
    };

    ws.onclose = () => {
      setStatus("closed");
      if (activeJobIds.current.size > 0) {
        activeJobIds.current.clear();
        setActiveJobs(0);
      }
      pushLine({ level: "warn", text: `… disconnected from ${url}` });
      scheduleReconnect();
    };
  }, [url, pushLine, flushQueue, handleEvent, scheduleReconnect]);

  const disconnect = useCallback(() => {
    manualCloseRef.current = true;
    if (reconnectTimer.current) {
      window.clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("closed");
  }, []);

  const clearLines = useCallback(() => setLines([]), []);

  useEffect(() => {
    if (autoConnect) connect();
    return () => {
      manualCloseRef.current = true;
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return {
    status,
    lines,
    activeJobs,
    lastError,
    url,
    moduleStates,
    send,
    connect,
    disconnect,
    clearLines,
    awaitJob,
    resetModules,
    markWaiting,
  };
}
