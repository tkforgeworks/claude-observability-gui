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

export function getCoworkAvailability(db: Database.Database): CoworkAvailability {
  return deriveCoworkAvailability({
    platformSupported: process.platform === 'win32',
    overrideActive: Boolean(loadSettings().logFilePath),
    hasHistoricalData: queryHasCoworkData(db),
  });
}
