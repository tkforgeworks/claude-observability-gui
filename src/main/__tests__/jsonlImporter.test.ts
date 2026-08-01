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
