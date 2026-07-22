import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type Database from 'better-sqlite3';
import type { UsageSnapshot } from '../../shared/ipc-types';
import { loadSettings } from '../config/configStore';
import { insertUsageSnapshot, pruneOldUsageSnapshots, queryLatestUsageSnapshot } from '../db/queries';

const MAX_SEVEN_DAY_EPOCH = 18_000_000_000_000_000_000;

interface UsageLimitFileData {
  data: {
    five_hour_pct: number;
    seven_day_pct: number;
    five_hour_resets_at: string;
    seven_day_resets_at: string;
  };
  expires_at: number;
}

export class UsageLimitWatcher extends EventEmitter {
  private readonly db: Database.Database;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastFileMtime: number = 0;
  private lastFilePath: string | null = null;
  private lastSkippedPath: string | null = null;
  private lastSkippedMtime: number = 0;

  constructor(db: Database.Database) {
    super();
    this.db = db;
  }

  start(pollIntervalMs: number = 60_000): void {
    this.pollOnce();
    this.pollTimer = setInterval(() => this.pollOnce(), pollIntervalMs);
    console.log(`[usageLimitWatcher] Started with ${pollIntervalMs / 1000}s interval`);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('[usageLimitWatcher] Stopped');
  }

  getLatest(): UsageSnapshot | null {
    return queryLatestUsageSnapshot(this.db);
  }

  private pollOnce(): void {
    try {
      const settings = loadSettings();
      const projectsDir = settings.claudeCodeDataPath ?? path.join(os.homedir(), '.claude', 'projects');

      if (!fs.existsSync(projectsDir)) {
        return;
      }

      const newest = this.findNewestUsageLimitFile(projectsDir);
      if (!newest) return;

      const raw = fs.readFileSync(newest.path, 'utf-8');
      const parsed: UsageLimitFileData = JSON.parse(raw);

      const now = Date.now();

      // An expired file is a stale cache left over from an old session —
      // it means "no current data", not "0% usage". Skip it entirely.
      // expires_at is epoch seconds; tolerate milliseconds defensively.
      const expiresAtMs = typeof parsed.expires_at === 'number' && Number.isFinite(parsed.expires_at)
        ? (parsed.expires_at > 1e12 ? parsed.expires_at : parsed.expires_at * 1000)
        : null;
      if (expiresAtMs !== null && expiresAtMs < now) {
        if (this.lastSkippedPath !== newest.path || this.lastSkippedMtime !== newest.mtimeMs) {
          console.log(
            `[usageLimitWatcher] Newest usage-limits file expired at ${new Date(expiresAtMs).toISOString()} — skipping ${newest.path}`
          );
          this.lastSkippedPath = newest.path;
          this.lastSkippedMtime = newest.mtimeMs;
        }
        return;
      }

      const fiveHourResets = parsed.data.five_hour_resets_at || null;
      const sevenDayResets = this.normalizeSevenDayReset(
        parsed.data.seven_day_resets_at,
        parsed.expires_at
      );

      const fiveHourPct = fiveHourResets && new Date(fiveHourResets).getTime() <= now
        ? 0 : parsed.data.five_hour_pct;
      const sevenDayPct = sevenDayResets && new Date(sevenDayResets).getTime() <= now
        ? 0 : parsed.data.seven_day_pct;

      insertUsageSnapshot(this.db, {
        captured_at: new Date(now).toISOString(),
        five_hour_pct: fiveHourPct,
        seven_day_pct: sevenDayPct,
        five_hour_resets_at: fiveHourResets,
        seven_day_resets_at: sevenDayResets,
        source_file: newest.path,
        expires_at: parsed.expires_at,
      });

      this.lastFilePath = newest.path;
      this.lastFileMtime = newest.mtimeMs;

      pruneOldUsageSnapshots(this.db, settings.usageLimitRetentionDays ?? 90);

      const snapshot = queryLatestUsageSnapshot(this.db);
      if (snapshot) {
        console.log(
          `[usageLimitWatcher] Snapshot: 5h=${snapshot.five_hour_pct}% 7d=${snapshot.seven_day_pct}%`
        );
        this.emit('snapshot', snapshot);
      }
    } catch (err) {
      console.error('[usageLimitWatcher] Poll error:', err);
      this.emit('error', err);
    }
  }

  private findNewestUsageLimitFile(
    projectsDir: string
  ): { path: string; mtimeMs: number } | null {
    let newest: { path: string; mtimeMs: number } | null = null;

    let projectDirs: string[];
    try {
      projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => path.join(projectsDir, d.name));
    } catch {
      return null;
    }

    for (const projectDir of projectDirs) {
      const cshipDir = path.join(projectDir, 'cship');
      if (!fs.existsSync(cshipDir)) continue;

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(cshipDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('-usage-limits')) continue;

        const filePath = path.join(cshipDir, entry.name);
        try {
          const stat = fs.statSync(filePath);
          if (!newest || stat.mtimeMs > newest.mtimeMs) {
            newest = { path: filePath, mtimeMs: stat.mtimeMs };
          }
        } catch {
          continue;
        }
      }
    }

    return newest;
  }

  private normalizeSevenDayReset(
    resets_at: string,
    expires_at: number
  ): string | null {
    if (!resets_at || resets_at === '') return null;
    if (expires_at > MAX_SEVEN_DAY_EPOCH) return null;
    return resets_at;
  }
}
