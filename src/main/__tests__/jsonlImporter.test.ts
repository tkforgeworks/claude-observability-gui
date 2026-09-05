// configStore pulls in electron at module load; aggregateSession never touches
// settings, so stub the module out for the node test environment.
jest.mock('../config/configStore', () => ({
  loadSettings: jest.fn(),
}));

import type Database from 'better-sqlite3';
import { JsonlImporter, JsonlRecord } from '../importers/jsonlImporter';

// aggregateSession does not use the db — a null handle is safe here.
const importer = new JsonlImporter(null as unknown as Database.Database);

function assistantRecord(overrides: {
  model?: string;
  requestId?: string;
  timestamp?: string;
  inputTokens?: number;
  outputTokens?: number;
}): JsonlRecord {
  return {
    type: 'assistant',
    sessionId: 'session-1',
    timestamp: overrides.timestamp ?? '2026-07-20T12:35:35.000Z',
    requestId: overrides.requestId,
    cwd: 'C:\\Code\\example',
    message: {
      model: overrides.model,
      stop_reason: 'end_turn',
      usage: {
        input_tokens: overrides.inputTokens ?? 0,
        output_tokens: overrides.outputTokens ?? 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  };
}

describe('aggregateSession model derivation (CGUI-58)', () => {
  it('derives the model from the first assistant record when it is real', () => {
    const session = importer.aggregateSession(
      'session-1',
      [
        assistantRecord({ model: 'claude-opus-5', requestId: 'req-1', inputTokens: 100, outputTokens: 50 }),
        assistantRecord({ model: 'claude-sonnet-5', requestId: 'req-2', inputTokens: 100, outputTokens: 50 }),
      ],
      []
    );
    expect(session?.model).toBe('claude-opus-5');
  });

  it('skips a leading <synthetic> error-injection record and uses the first real model', () => {
    // Mirrors the confirmed real-world case: a locally-injected 401 record
    // (model "<synthetic>", all-zero usage) precedes the real turns.
    const session = importer.aggregateSession(
      'session-1',
      [
        assistantRecord({ model: '<synthetic>', requestId: 'req-0' }),
        assistantRecord({ model: 'claude-opus-5', requestId: 'req-1', inputTokens: 100, outputTokens: 50 }),
      ],
      []
    );
    expect(session?.model).toBe('claude-opus-5');
  });

  it('skips <synthetic> records interleaved mid-session', () => {
    const session = importer.aggregateSession(
      'session-1',
      [
        assistantRecord({ model: '<synthetic>', requestId: 'req-0' }),
        assistantRecord({ model: '<synthetic>', requestId: 'req-1' }),
        assistantRecord({ model: 'claude-sonnet-5', requestId: 'req-2', inputTokens: 100, outputTokens: 50 }),
      ],
      []
    );
    expect(session?.model).toBe('claude-sonnet-5');
  });

  it('yields model null when every assistant record is <synthetic> but tokens exist', () => {
    const session = importer.aggregateSession(
      'session-1',
      [assistantRecord({ model: '<synthetic>', requestId: 'req-0', inputTokens: 100 })],
      []
    );
    expect(session?.model).toBeNull();
  });

  it('returns null for a session with only zero-usage synthetic records', () => {
    const session = importer.aggregateSession(
      'session-1',
      [assistantRecord({ model: '<synthetic>', requestId: 'req-0' })],
      []
    );
    expect(session).toBeNull();
  });

  it('finds the real model in a subagent file when the main file only has synthetic records', () => {
    const session = importer.aggregateSession(
      'session-1',
      [assistantRecord({ model: '<synthetic>', requestId: 'req-0' })],
      [[assistantRecord({ model: 'claude-opus-5', requestId: 'req-sub-1', inputTokens: 200, outputTokens: 80 })]]
    );
    expect(session?.model).toBe('claude-opus-5');
  });
});

describe('aggregateSession hourly bucketing (CGUI-87)', () => {
  it('buckets final chunks by UTC hour and bucket totals sum to session totals', () => {
    const session = importer.aggregateSession(
      'session-1',
      [
        assistantRecord({ model: 'claude-opus-5', requestId: 'r1', timestamp: '2026-08-06T10:05:00.000Z', inputTokens: 100, outputTokens: 10 }),
        assistantRecord({ model: 'claude-opus-5', requestId: 'r2', timestamp: '2026-08-06T10:59:59.999Z', inputTokens: 200, outputTokens: 20 }),
        assistantRecord({ model: 'claude-opus-5', requestId: 'r3', timestamp: '2026-08-08T14:00:00.000Z', inputTokens: 400, outputTokens: 40 }),
      ],
      []
    );
    expect(session?.hours).toEqual([
      expect.objectContaining({ hourStart: '2026-08-06T10:00:00.000Z', inputTokens: 300, outputTokens: 30 }),
      expect.objectContaining({ hourStart: '2026-08-08T14:00:00.000Z', inputTokens: 400, outputTokens: 40 }),
    ]);
    const summedIn = session!.hours.reduce((s, h) => s + h.inputTokens, 0);
    const summedOut = session!.hours.reduce((s, h) => s + h.outputTokens, 0);
    expect(summedIn).toBe(session!.inputTokens);
    expect(summedOut).toBe(session!.outputTokens);
  });

  it('attributes a chunk without its own timestamp to the session start hour', () => {
    const noTs: JsonlRecord = {
      type: 'assistant',
      sessionId: 'session-1',
      requestId: 'r-nots',
      message: {
        model: 'claude-opus-5',
        stop_reason: 'end_turn',
        usage: { input_tokens: 50, output_tokens: 5 },
      },
    };
    const session = importer.aggregateSession(
      'session-1',
      [
        assistantRecord({ model: 'claude-opus-5', requestId: 'r1', timestamp: '2026-08-06T10:05:00.000Z', inputTokens: 100, outputTokens: 10 }),
        noTs,
      ],
      []
    );
    expect(session?.hours).toHaveLength(1);
    expect(session?.hours[0]).toEqual(
      expect.objectContaining({ hourStart: '2026-08-06T10:00:00.000Z', inputTokens: 150, outputTokens: 15 })
    );
  });

  it('includes subagent usage in the hour it occurred', () => {
    const session = importer.aggregateSession(
      'session-1',
      [assistantRecord({ model: 'claude-opus-5', requestId: 'r1', timestamp: '2026-08-06T10:05:00.000Z', inputTokens: 100, outputTokens: 10 })],
      [[assistantRecord({ model: 'claude-opus-5', requestId: 'r-sub', timestamp: '2026-08-06T11:10:00.000Z', inputTokens: 30, outputTokens: 3 })]]
    );
    expect(session?.hours.map(h => h.hourStart)).toEqual([
      '2026-08-06T10:00:00.000Z',
      '2026-08-06T11:00:00.000Z',
    ]);
  });
});
