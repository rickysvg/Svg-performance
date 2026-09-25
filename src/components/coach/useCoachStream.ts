"use client";

import { useRef, useState } from "react";
import {
  STREAM_FAIL_COPY,
  STREAM_STOPPED_MARKER,
  type CoachStreamEvent,
  type CoachStreamRequest,
} from "@/lib/coach/stream-types";

export function useCoachStream() {
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  function stop() {
    abortRef.current?.abort();
  }

  async function start(body: CoachStreamRequest) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    setPartial("");
    setError("");
    setOffline(false);
    let assembled = "";
    let liveOffline = false;

    try {
      const response = await fetch("/api/coach/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "SVG Coach could not start that reply.");
      }
      if (!response.body) {
        throw new Error("SVG Coach could not start that reply.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const event = JSON.parse(line.slice(5).trim()) as CoachStreamEvent;
          if (event.type === "delta") {
            assembled += event.text;
            setPartial(assembled);
          } else if (event.type === "done") {
            assembled = event.content;
            liveOffline = event.offline;
            setPartial(event.content);
            setOffline(event.offline);
          } else if (event.type === "error") {
            setError(event.message);
          } else if (event.type === "meta") {
            liveOffline = event.offline;
            setOffline(event.offline);
          }
        }
      }
      return { content: assembled, offline: liveOffline };
    } catch (caught) {
      if (controller.signal.aborted) {
        const kept = assembled.includes("[Stopped")
          ? assembled
          : assembled
            ? `${assembled}${STREAM_STOPPED_MARKER}`
            : assembled;
        setPartial(kept);
        return { content: kept, offline: liveOffline };
      }
      const message =
        caught instanceof Error ? caught.message : STREAM_FAIL_COPY;
      setError(message);
      return { content: "", offline: liveOffline };
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  return { streaming, partial, error, offline, start, stop, setError, setPartial };
}
