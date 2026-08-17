/**
 * Cowork availability model — the main-process source of truth for
 * "is Cowork a thing on this install?" (CGUI-81).
 *
 * CGUI-75's log path status covers platform support and the override, but not
 * the historical-data case (CGUI-49 imports on a platform without Claude
 * Desktop). Every Cowork surface consumes this model via the
 * `cowork:getAvailability` channel instead of re-deriving its own answer.
 */

import type Database from 'better-sqlite3';
import type { CoworkAvailability } from '../../shared/ipc-types';
import { loadSettings } from '../config/configStore';
import { queryHasCoworkData } from '../db/queries';

export interface CoworkAvailabilityInputs {
  platformSupported: boolean;
  overrideActive: boolean;
  hasHistoricalData: boolean;
}

/**
 * Pure derivation, separated for the platform × override × data test matrix.
 *
 * 'live' means collection is possible in principle — whether the watcher is
 * currently connected stays the LogWatcher banner's concern, not this model's
 * (a supported platform with Claude Desktop not yet installed is still 'live').
 */
export function deriveCoworkAvailability(inputs: CoworkAvailabilityInputs): CoworkAvailability {
  const liveCapable = inputs.platformSupported || inputs.overrideActive;
  const mode = liveCapable ? 'live' : inputs.hasHistoricalData ? 'historical' : 'none';
  return {
    available: mode !== 'none',
    mode,
    platformSupported: inputs.platformSupported,
    overrideActive: inputs.overrideActive,
    hasHistoricalData: inputs.hasHistoricalData,
  };
}

/**
 * Cached `logFilePath` override presence (CGUI-93). `loadSettings()` is an
 * uncached file read + JSON.parse, and the tray refresh asks for availability
 * on every LogWatcher event — including each line of the startup backfill —
 * so the override answer is read once and dropped only when `settings:update`
 * carries a `logFilePath` (the one in-app path that changes it; a hand edit
 * of settings.json needs a restart anyway, which is what the Settings copy
 * says).
 */
let overrideActiveCache: boolean | null = null;

export function invalidateCoworkOverrideCache(): void {
  overrideActiveCache = null;
}

function isOverrideActive(): boolean {
  if (overrideActiveCache === null) {
    overrideActiveCache = Boolean(loadSettings().logFilePath);
  }
  return overrideActiveCache;
}

/**
 * Cheap "can Cowork be collected on this install?" for hot paths (the tray
 * refresh). On win32 this is decided by the platform alone — no settings
 * read, no DB query — and elsewhere it costs one cached settings read.
 */
export function isCoworkLiveCapable(): boolean {
  return process.platform === 'win32' || isOverrideActive();
}

export function getCoworkAvailability(db: Database.Database): CoworkAvailability {
  const platformSupported = process.platform === 'win32';
  return deriveCoworkAvailability({
    platformSupported,
    overrideActive: isOverrideActive(),
    hasHistoricalData: queryHasCoworkData(db),
  });
}
