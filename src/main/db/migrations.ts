import type Database from 'better-sqlite3';

/**
 * Migration definition. Each migration is a sequential version number
 * and a SQL string that may contain multiple semicolon-separated statements.
 */
export interface Migration {
  version: number;
  sql: string;
}

/**
 * All schema migrations in version order.
 *
 * Migration v1 creates the initial schema (all tables from §3 of architecture doc).
 * Every subsequent schema change is a new numbered migration appended here.
 * Do NOT modify existing migrations — add new ones.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      -- -----------------------------------------------------------------------
      -- v1: Initial schema — all tables per §3 of architecture doc
      -- -----------------------------------------------------------------------

      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '0');

      -- One row per Claude Desktop application launch
      CREATE TABLE IF NOT EXISTS app_sessions (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        launched_at      TEXT NOT NULL,
        quit_at          TEXT,
        duration_seconds INTEGER,
        synced_to_influx INTEGER DEFAULT 0
      );

      -- One row per Cowork session
      CREATE TABLE IF NOT EXISTS cowork_sessions (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id       TEXT UNIQUE NOT NULL,
        cli_session_id   TEXT,
        title            TEXT,
        started_at       TEXT NOT NULL,
        ended_at         TEXT,
        turn_count       INTEGER DEFAULT 0,
        synced_to_influx INTEGER DEFAULT 0
      );

      -- One row per completed Cowork turn
      CREATE TABLE IF NOT EXISTS cowork_turns (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id       TEXT NOT NULL,
        started_at       TEXT NOT NULL,
        ended_at         TEXT NOT NULL,
        duration_seconds INTEGER,
        synced_to_influx INTEGER DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES cowork_sessions (session_id)
      );

      -- One row per Claude Code session, sourced from JSONL files
      CREATE TABLE IF NOT EXISTS code_sessions (
        id                     INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id             TEXT UNIQUE NOT NULL,
        project_path           TEXT,
        model                  TEXT,
        input_tokens           INTEGER,
        output_tokens          INTEGER,
        cache_creation_tokens  INTEGER,
        cache_read_tokens      INTEGER,
        cost_usd               REAL,
        started_at             TEXT,
        ended_at               TEXT,
        synced_to_influx       INTEGER DEFAULT 0
      );

      -- One row per Desktop chat conversation, sourced from claude.ai export
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT UNIQUE NOT NULL,
        title           TEXT,
        message_count   INTEGER,
        created_at      TEXT,
        updated_at      TEXT,
        imported_at     TEXT
      );

      -- One row per SkillsPlugin heartbeat (window focus event)
      CREATE TABLE IF NOT EXISTS app_focus_events (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        focused_at        TEXT NOT NULL,
        gap_since_last_ms INTEGER
      );

      -- Indexes for common query patterns
      CREATE INDEX IF NOT EXISTS idx_code_sessions_started_at     ON code_sessions (started_at);
      CREATE INDEX IF NOT EXISTS idx_code_sessions_project_path   ON code_sessions (project_path);
      CREATE INDEX IF NOT EXISTS idx_cowork_sessions_started_at   ON cowork_sessions (started_at);
      CREATE INDEX IF NOT EXISTS idx_cowork_turns_session_id      ON cowork_turns (session_id);
      CREATE INDEX IF NOT EXISTS idx_app_focus_events_focused_at  ON app_focus_events (focused_at);

      -- Sync pending indexes
      CREATE INDEX IF NOT EXISTS idx_code_sessions_unsynced       ON code_sessions (synced_to_influx) WHERE synced_to_influx = 0;
      CREATE INDEX IF NOT EXISTS idx_cowork_sessions_unsynced     ON cowork_sessions (synced_to_influx) WHERE synced_to_influx = 0;
      CREATE INDEX IF NOT EXISTS idx_cowork_turns_unsynced        ON cowork_turns (synced_to_influx) WHERE synced_to_influx = 0;
      CREATE INDEX IF NOT EXISTS idx_app_sessions_unsynced        ON app_sessions (synced_to_influx) WHERE synced_to_influx = 0;
    `,
  },
  {
    version: 2,
    sql: `ALTER TABLE code_sessions ADD COLUMN slug TEXT;`,
  },
  {
    version: 3,
    sql: `ALTER TABLE cowork_sessions ADD COLUMN project_path TEXT;`,
  },
  {
    version: 4,
    sql: `
      -- -----------------------------------------------------------------------
      -- v4: Projects and memories tables for claude.ai export import
      -- -----------------------------------------------------------------------

      CREATE TABLE IF NOT EXISTS chat_projects (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id      TEXT UNIQUE NOT NULL,
        name            TEXT,
        description     TEXT,
        is_private      INTEGER DEFAULT 0,
        doc_count       INTEGER DEFAULT 0,
        created_at      TEXT,
        updated_at      TEXT,
        imported_at     TEXT
      );

      CREATE TABLE IF NOT EXISTS chat_memories (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        account_uuid    TEXT NOT NULL,
        type            TEXT NOT NULL,
        project_id      TEXT,
        content_length  INTEGER DEFAULT 0,
        imported_at     TEXT,
        UNIQUE(account_uuid, type, project_id)
      );

      CREATE INDEX IF NOT EXISTS idx_chat_projects_created_at ON chat_projects (created_at);
      CREATE INDEX IF NOT EXISTS idx_chat_memories_account     ON chat_memories (account_uuid);
    `,
  },
];

/**
 * Runs all pending migrations against the given database connection.
 *
 * Reads current schema_version from the meta table, then executes all
 * migrations with version > current in a single transaction. Updates
 * schema_version after each successful migration. Rolls back everything
 * if any migration fails.
 *
 * @see §3 "Schema Migration System" in architecture doc
 */
export function runMigrations(db: Database.Database): void {
  // Ensure the meta table and initial schema_version row exist before reading
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '0');
  `);

  const getVersion = db.prepare<[], { value: string }>(
    `SELECT value FROM meta WHERE key = 'schema_version'`
  );
  const setVersion = db.prepare<[string], void>(
    `UPDATE meta SET value = ? WHERE key = 'schema_version'`
  );

  const currentVersionRow = getVersion.get();
  const currentVersion = currentVersionRow ? parseInt(currentVersionRow.value, 10) : 0;

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);

  if (pending.length === 0) {
    console.log(`[migrations] Schema is up to date at version ${currentVersion}`);
    return;
  }

  console.log(
    `[migrations] Running ${pending.length} pending migration(s) from v${currentVersion}`
  );

  const runAll = db.transaction(() => {
    for (const migration of pending) {
      console.log(`[migrations] Applying migration v${migration.version}`);
      db.exec(migration.sql);
      setVersion.run(String(migration.version));
    }
  });

  runAll();

  const finalVersion = pending[pending.length - 1].version;
  console.log(`[migrations] Schema updated to version ${finalVersion}`);
}
