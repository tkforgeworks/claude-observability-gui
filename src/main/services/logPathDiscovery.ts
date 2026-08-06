/**
 * MSIX path auto-discovery for Claude Desktop's main.log.
 *
 * Claude Desktop on Windows is installed as an MSIX package. The log file lives at:
 *   %LOCALAPPDATA%\Packages\Claude_<hash>\LocalCache\Roaming\Claude\logs\main.log
 *
 * This module globs for that path on startup, caches the result in memory,
 * and falls back to the settings override (logFilePath) if the glob finds nothing.
 *
 * @see CGUI-12
 */

import fs from 'fs';
import path from 'path';
import type { LogPathStatus } from '../../shared/ipc-types';
import { loadSettings } from '../config/configStore';

const MSIX_PACKAGE_PREFIX = 'Claude_';
const MSIX_LOG_SUBPATH = 'LocalCache/Roaming/Claude/logs/main.log';

let cachedAutoPath: string | null = null;

/**
 * Scans %LOCALAPPDATA%\Packages for a directory matching Claude_* and checks
 * whether main.log exists inside it. Caches the first match.
 * Safe to call multiple times — re-scans each time to pick up new installs.
 */
export function discoverLogPath(): string | null {
  // Claude Desktop only exists on Windows/macOS; the MSIX layout is
  // Windows-only. Skip quietly on other platforms (CGUI-75).
  if (process.platform !== 'win32') {
    cachedAutoPath = null;
    return null;
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    console.warn('[logPathDiscovery] LOCALAPPDATA env var not set — skipping auto-discovery');
    cachedAutoPath = null;
    return null;
  }

  const packagesDir = path.join(localAppData, 'Packages');
  try {
    if (!fs.existsSync(packagesDir)) {
      cachedAutoPath = null;
      console.log('[logPathDiscovery] Packages directory not found');
      return null;
    }

    const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith(MSIX_PACKAGE_PREFIX)) {
        const candidate = path.join(packagesDir, entry.name, MSIX_LOG_SUBPATH);
        if (fs.existsSync(candidate)) {
          cachedAutoPath = candidate;
          console.log(`[logPathDiscovery] Auto-discovered: ${cachedAutoPath}`);
          return cachedAutoPath;
        }
      }
    }

    cachedAutoPath = null;
    console.log('[logPathDiscovery] No MSIX log path found');
  } catch (err) {
    console.error('[logPathDiscovery] Discovery failed:', err);
    cachedAutoPath = null;
  }

  return cachedAutoPath;
}

/**
 * Returns the effective log path and its status.
 *
 * Priority:
 *   1. Settings override (logFilePath) — if set, validate it exists
 *   2. Auto-discovered MSIX path — from cached glob result
 *   3. Not found
 */
export function getLogPathStatus(): LogPathStatus {
  const settings = loadSettings();

  // Settings override takes priority
  if (settings.logFilePath) {
    const valid = fs.existsSync(settings.logFilePath);
    return {
      path: settings.logFilePath,
      source: 'settings-override',
      valid,
    };
  }

  // No override on a platform without Claude Desktop: report unsupported,
  // not "not found" — the renderer must not treat this as an error (CGUI-75)
  if (process.platform !== 'win32') {
    return {
      path: null,
      source: 'unsupported-platform',
      valid: false,
    };
  }

  // Auto-discovered path
  if (cachedAutoPath) {
    const valid = fs.existsSync(cachedAutoPath);
    return {
      path: cachedAutoPath,
      source: 'auto-discovered',
      valid,
    };
  }

  return {
    path: null,
    source: 'not-found',
    valid: false,
  };
}

/**
 * Returns the cached auto-discovered path (or null).
 * Does NOT re-run discovery — call discoverLogPath() first.
 */
export function getCachedLogPath(): string | null {
  return cachedAutoPath;
}
