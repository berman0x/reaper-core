import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Generic streaming WebSocket hook for the Reaper monitor dashboard.
 *
 * Features:
 *  - Reads VITE_WS_URL, falls back to ws://localhost:3000
 *  - Auto-reconnect with exponential backoff (capped)
 *  - Outbound message queue while disconnected
 *  - Parses incoming JSON events: job_started, output, done, error
 *  - Maintains a rolling `lines` buffer and an `activeJobs` count
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

type InboundEvent =
  | { type: "job_started"; jobId: string; module?: string; target?: string }
  | { type: "output"; jobId?: string; line: string; level?: TerminalLineLevel }
  | { type: "done"; jobId: string; status?: "success" | "error" | "stopped" }
  | { type: "error"; jobId?: string; message: string };

type OutboundMessage = Record<string, unknown>;

export type UseWebSocketOptions = {
  url?: string;
  maxLines?: number;
  autoConnect?: boolean;
};

const DEFAULT_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ?? "ws://localhost:3000";

let lineSeq = 0;

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { url = DEFAULT_URL, maxLines = 2000, autoConnect = true } = options;

  const [status, setStatus] = useState<WSStatus>("closed");
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [activeJobs, setActiveJobs] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<OutboundMessage[]>([]);
  const retryRef = useRef(0);
  const reconnectTimer = useRef<number | null>(null);
  const manualCloseRef = useRef(false);
  const activeJobIds = useRef<Set<string>>(new Set());

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

  const send = useCallback(
    (msg: OutboundMessage) => {
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
    },
    [],
  );

  const handleEvent = useCallback(
    (ev: InboundEvent) => {
      switch (ev.type) {
        case "job_started": {
          activeJobIds.current.add(ev.jobId);
          setActiveJobs(activeJobIds.current.size);
          pushLine({
            jobId: ev.jobId,
            module: ev.module,
            level: "system",
            text: `▶ job ${ev.jobId} started${ev.module ? ` (${ev.module})` : ""}${ev.target ? ` → ${ev.target}` : ""}`,
          });
          break;
        }
        case "output": {
          pushLine({
            jobId: ev.jobId,
            level: ev.level ?? "output",
            text: ev.line,
          });
          break;
        }
        case "done": {
          if (activeJobIds.current.delete(ev.jobId)) {
            setActiveJobs(activeJobIds.current.size);
          }
          pushLine({
            jobId: ev.jobId,
            level: ev.status === "error" ? "error" : "success",
            text: `■ job ${ev.jobId} ${ev.status ?? "done"}`,
          });
          break;
        }
        case "error": {
          if (ev.jobId && activeJobIds.current.delete(ev.jobId)) {
            setActiveJobs(activeJobIds.current.size);
          }
          setLastError(ev.message);
          pushLine({
            jobId: ev.jobId,
            level: "error",
            text: `✗ ${ev.message}`,
          });
          break;
        }
      }
    },
    [pushLine],
  );

  const scheduleReconnect = useCallback(() => {
    if (manualCloseRef.current) return;
    const attempt = retryRef.current++;
    const delay = Math.min(30_000, 500 * Math.pow(2, attempt)) + Math.random() * 250;
    if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
    reconnectTimer.current = window.setTimeout(() => {
      connect();
    }, delay);
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
      // Any jobs that were in-flight are effectively lost
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
    send,
    connect,
    disconnect,
    clearLines,
  };
}
