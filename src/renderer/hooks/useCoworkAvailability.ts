/**
 * Shared renderer-side view of the Cowork availability model (CGUI-81).
 *
 * Wraps `cowork:getAvailability` with a module-level cache so N consumers
 * (nav, Today, Trends, Heatmap, empty states) fire one IPC call, not N.
 * Availability can't change mid-session except when path discovery re-runs
 * (LogWatcher retry after a logFilePath override edit) or a CGUI-49 import
 * lands — the first is covered by the onLogWatcherConnection subscription
 * below, the second by callers invoking invalidateCoworkAvailability().
 *
 * Returns null while unknown (fetch pending or failed) — consumers keep
 * their platform-neutral fallback copy in that state, never an error UI.
 */

import { useEffect, useState } from 'react';
import type { CoworkAvailability } from '../../shared/ipc-types';

let cache: CoworkAvailability | null = null;
let inflight: Promise<void> | null = null;
let watcherSubscribed = false;
const subscribers = new Set<() => void>();

function fetchAvailability(): Promise<void> {
  inflight ??= window.api.cowork.getAvailability()
    .then(result => {
      cache = result;
      subscribers.forEach(notify => notify());
    })
    .catch(() => { /* cache stays null — consumers keep fallback copy */ })
    .finally(() => { inflight = null; });
  return inflight;
}

/** Drops the cache and refetches — call after anything that can change availability inputs (e.g. a data import). */
export function invalidateCoworkAvailability(): void {
  cache = null;
  void fetchAvailability();
}

export function useCoworkAvailability(): CoworkAvailability | null {
  const [availability, setAvailability] = useState<CoworkAvailability | null>(cache);

  useEffect(() => {
    const notify = (): void => setAvailability(cache);
    subscribers.add(notify);

    // Connection changes mean path discovery re-ran (startup, or Retry after
    // an override edit) — exactly when availability inputs may have moved.
    if (!watcherSubscribed) {
      watcherSubscribed = true;
      window.api.onLogWatcherConnection(() => invalidateCoworkAvailability());
    }

    if (cache) {
      setAvailability(cache);
    } else {
      void fetchAvailability();
    }
    return () => { subscribers.delete(notify); };
  }, []);

  return availability;
}
