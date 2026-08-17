"use client";

import { useEffect, useRef } from "react";

/**
 * Studionet rate-limits to 30 RPC calls per minute per IP, shared across every
 * open tab and any script you happen to be running. So: poll slowly, and never
 * poll a tab nobody is looking at.
 */
export function usePoll(fn: () => void | Promise<void>, intervalMs: number, enabled = true) {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;

    const tick = async (force = false) => {
      if (stopped) return;
      // Only the repeat beats are gated on visibility. The first read always
      // runs, or a backgrounded tab renders an empty page forever.
      if (!force && typeof document !== "undefined" && document.visibilityState !== "visible") return;
      await saved.current();
    };

    void tick(true);
    const id = setInterval(() => void tick(), intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, enabled]);
}
