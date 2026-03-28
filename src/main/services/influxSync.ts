/**
 * InfluxDB sync service — Remote Sync Tier.
 * Pushes SQLite data to InfluxDB as line protocol points. Best-effort,
 * never blocks the local write path. Not implemented until v0.4.
 *
 * @see §4 of architecture doc for full specification
 */

import { EventEmitter } from 'events';
import type Database from 'better-sqlite3';
import type { SyncStatus } from '../../shared/ipc-types';

/**
 * InfluxSync manages background synchronisation of SQLite data to the
 * InfluxDB homelab instance. Runs a retry job on a 60-second interval
 * for any rows where synced_to_influx = 0.
 *
 * Not implemented until v0.4 — constructor and methods are stubs.
 */
export class InfluxSync extends EventEmitter {
  private readonly db: Database.Database;
  private retryIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(db: Database.Database) {
    super();
    this.db = db;
  }

  /**
   * Starts the 60-second background retry job.
   * Should be called after settings are loaded and sync is enabled.
   */
  start(): void {
    // TODO: implement (v0.4)
    // 1. Check settings.syncEnabled — bail if false
    // 2. Set up setInterval(this.syncPendingRows.bind(this), 60_000)
    console.log('[influxSync] start() called — not implemented until v0.4');
  }

  /**
   * Stops the background retry job and cancels any in-flight requests.
   */
  stop(): void {
    // TODO: implement (v0.4)
    if (this.retryIntervalId) {
      clearInterval(this.retryIntervalId);
      this.retryIntervalId = null;
    }
    console.log('[influxSync] stop() called — not implemented until v0.4');
  }

  /**
   * Manually triggers a sync cycle immediately.
   * Reads all pending rows (synced_to_influx = 0) across all tables,
   * batches them in groups of 100, writes line protocol to InfluxDB,
   * and updates synced_to_influx = 1 on success.
   *
   * @see §4 "Sync Implementation Notes" in architecture doc
   */
  async syncNow(): Promise<void> {
    // TODO: implement (v0.4)
    throw new Error('InfluxSync.syncNow() not yet implemented');
  }

  /**
   * Tests the connection to the InfluxDB instance for the given profile.
   * Returns true if the connection succeeds, false otherwise.
   *
   * @see §4 "InfluxDB token must be encrypted at rest using safeStorage"
   */
  async testConnection(profileId: string): Promise<boolean> {
    // TODO: implement (v0.4)
    // 1. Load profile from settings by profileId
    // 2. Decrypt token from safeStorage
    // 3. Attempt a /health or /ping endpoint call
    return false;
  }

  /**
   * Returns the current sync status including pending row counts.
   */
  getStatus(): SyncStatus {
    // TODO: implement (v0.4)
    return {
      enabled: false,
      lastSyncAt: null,
      isOnline: false,
      pendingRows: {
        app_sessions: 0,
        cowork_sessions: 0,
        cowork_turns: 0,
        code_sessions: 0,
        chat_conversations: 0,
      },
    };
  }

  /**
   * Background retry handler called by the interval timer.
   */
  private async syncPendingRows(): Promise<void> {
    // TODO: implement (v0.4)
    // Query all tables for synced_to_influx = 0, batch to 100 points,
    // convert to InfluxDB line protocol, write via @influxdata/influxdb-client-js
    throw new Error('InfluxSync.syncPendingRows() not yet implemented');
  }
}
