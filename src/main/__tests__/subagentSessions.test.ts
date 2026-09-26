/**
 * Regression tests for CGUI-138: workflow subagent transcripts at
 * {sessionId}/subagents/workflows/wf_<id>/agent-*.jsonl were imported as
 * standalone Code sessions (a single workflow run added 25 "sessions") instead
 * of counting toward the session that launched them.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

const mockLoadSettings = jest.fn();
jest.mock('../config/configStore', () => ({
  loadSettings: () => mockLoadSettings(),
}));

import { discoverSessionFiles, JsonlImporter } from '../importers/jsonlImporter';
import { runMigrations } from '../db/migrations';

function assistantLine(requestId: string, timestamp: string, inputTokens: number, outputTokens: number): string {
  return JSON.stringify({
    type: 'assistant',
    requestId,
    timestamp,
    cwd: '/home/u/project',
    message: {
      model: 'claude-fable-5-1',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  });
}

function write(file: string, lines: string[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

/**
 * Builds a projects dir with:
 *  - parent session with a flat subagent and a nested workflow subagent
 *  - a plain session with no subagents
 *  - an orphaned subagent dir whose main transcript is gone
 */
function buildProjectsDir(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgui-138-'));
  const proj = path.join(root, '-home-u-project');
  write(path.join(proj, 'parent.jsonl'), [assistantLine('req-p', '2026-09-20T10:00:00.000Z', 100, 10)]);
  write(path.join(proj, 'parent', 'subagents', 'agent-flat.jsonl'), [
    assistantLine('req-f', '2026-09-20T10:05:00.000Z', 20, 2),
  ]);
  // Sidecar metadata next to a transcript is not a transcript
  write(path.join(proj, 'parent', 'subagents', 'agent-flat.meta.json'), ['{}']);
  write(path.join(proj, 'parent', 'subagents', 'workflows', 'wf_abc', 'agent-wf.jsonl'), [
    assistantLine('req-w', '2026-09-20T10:10:00.000Z', 300, 30),
  ]);
  write(path.join(proj, 'solo.jsonl'), [assistantLine('req-s', '2026-09-20T11:00:00.000Z', 5, 1)]);
  write(path.join(proj, 'gone', 'subagents', 'workflows', 'wf_def', 'agent-orphan.jsonl'), [
    assistantLine('req-o', '2026-09-20T12:00:00.000Z', 7, 7),
  ]);
  return root;
}

describe('discoverSessionFiles (CGUI-138)', () => {
  let root: string;
  beforeAll(() => { root = buildProjectsDir(); });
  afterAll(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('groups flat and nested workflow subagent transcripts under their parent session', () => {
    const sessions = discoverSessionFiles(root);
    const parent = sessions.get('parent');
    expect(parent).toBeDefined();
    expect(parent!.subagentFiles.map((f) => path.basename(f)).sort()).toEqual([
      'agent-flat.jsonl',
      'agent-wf.jsonl',
    ]);
  });

  it('never treats a file under subagents/ as a session of its own', () => {
    const sessions = discoverSessionFiles(root);
    expect([...sessions.keys()].sort()).toEqual(['parent', 'solo']);
  });

  it('drops subagent transcripts whose parent transcript is gone', () => {
    const sessions = discoverSessionFiles(root);
    expect(sessions.has('gone')).toBe(false);
    expect(sessions.has('agent-orphan')).toBe(false);
  });
});

// Same Electron-ABI guard as the other DB-backed suites: the native binding
// can't load under jest's node runtime after an electron-rebuild. CI installs
// the node prebuild, so these run there.
let sqliteAvailable = true;
try {
  new Database(':memory:').close();
} catch {
  sqliteAvailable = false;
  console.warn(
    '[subagentSessions.test] better-sqlite3 binding not loadable under node — ' +
    'skipping DB scan tests. They run in CI.'
  );
}
const describeDb = sqliteAvailable ? describe : describe.skip;

describeDb('JsonlImporter.scan subagent cleanup (CGUI-138)', () => {
  let root: string;
  let db: Database.Database;

  const insertBogus = (sessionId: string, tokens: number) => {
    db.prepare(`
      INSERT INTO code_sessions (session_id, project_path, model, input_tokens, output_tokens,
        cache_creation_tokens, cache_read_tokens, cost_usd, started_at, ended_at)
      VALUES (?, '/home/u/project', 'claude-fable-5-1', ?, 0, 0, 0, 1.0,
        '2026-09-20T10:10:00.000Z', '2026-09-20T10:10:00.000Z')
    `).run(sessionId, tokens);
    db.prepare(`
      INSERT INTO code_session_hours (session_id, hour_start, input_tokens, cost_usd)
      VALUES (?, '2026-09-20T10:00:00.000Z', ?, 1.0)
    `).run(sessionId, tokens);
  };

  const sessionIds = () =>
    (db.prepare(`SELECT session_id FROM code_sessions ORDER BY session_id`).all() as { session_id: string }[])
      .map((r) => r.session_id);

  beforeEach(() => {
    root = buildProjectsDir();
    mockLoadSettings.mockReturnValue({ claudeCodeDataPath: root });
    db = new Database(':memory:');
    runMigrations(db);
    // State left behind by a pre-CGUI-138 scan
    insertBogus('agent-wf', 300);
    insertBogus('agent-orphan', 7);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('removes rows previously imported from nested subagent transcripts', async () => {
    await new JsonlImporter(db).scan();
    expect(sessionIds()).not.toContain('agent-wf');
    const orphanHours = db.prepare(`SELECT COUNT(*) AS n FROM code_session_hours WHERE session_id = 'agent-wf'`).get() as { n: number };
    expect(orphanHours.n).toBe(0);
  });

  it('attributes flat and nested subagent usage to the parent session', async () => {
    await new JsonlImporter(db).scan();
    const parent = db.prepare(`SELECT input_tokens, output_tokens FROM code_sessions WHERE session_id = 'parent'`).get() as {
      input_tokens: number;
      output_tokens: number;
    };
    expect(parent).toEqual({ input_tokens: 100 + 20 + 300, output_tokens: 10 + 2 + 30 });
  });

  it('keeps rows it cannot re-attribute because the parent transcript is gone', async () => {
    await new JsonlImporter(db).scan();
    expect(sessionIds()).toEqual(['agent-orphan', 'parent', 'solo']);
  });
});
