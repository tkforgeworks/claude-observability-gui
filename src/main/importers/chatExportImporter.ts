/**
 * Claude.ai Export ZIP Importer.
 * Parses a claude.ai data export ZIP file containing conversations.json,
 * projects.json, and memories.json. Upserts metadata (no message content)
 * into SQLite tables: chat_conversations, chat_projects, chat_memories.
 *
 * @see CGUI-36
 */

import AdmZip from 'adm-zip';
import type Database from 'better-sqlite3';
import type { ImportSummary } from '../../shared/ipc-types';

// ---------------------------------------------------------------------------
// Raw shapes from the claude.ai export ZIP
// ---------------------------------------------------------------------------

interface ExportConversation {
  uuid: string;
  name: string;
  summary?: string;
  created_at: string;
  updated_at: string;
  account?: { uuid: string };
  chat_messages?: unknown[];
}

interface ExportProject {
  uuid: string;
  name: string;
  description?: string;
  is_private?: boolean;
  is_starter_project?: boolean;
  created_at: string;
  updated_at: string;
  creator?: { uuid: string; full_name?: string };
  docs?: unknown[];
}

interface ExportMemoryEntry {
  conversations_memory?: string;
  project_memories?: Record<string, string>;
  account_uuid: string;
}

// ---------------------------------------------------------------------------
// Importer
// ---------------------------------------------------------------------------

export class ChatExportImporter {
  constructor(private db: Database.Database) {}

  /**
   * Import a claude.ai data export ZIP file.
   * Reads conversations.json, projects.json, and memories.json from the
   * archive, upserting metadata into SQLite. No message content is stored.
   */
  import(filePath: string): ImportSummary {
    const startTime = Date.now();
    let newRecords = 0;
    let updatedRecords = 0;
    let skippedRecords = 0;
    let errorCount = 0;

    let zip: AdmZip;
    try {
      zip = new AdmZip(filePath);
    } catch (err) {
      console.error('[chatExportImporter] Failed to open ZIP:', err);
      return {
        newRecords: 0,
        updatedRecords: 0,
        skippedRecords: 0,
        errorCount: 1,
        scanDurationMs: Date.now() - startTime,
        scannedAt: new Date().toISOString(),
      };
    }

    // --- Conversations ---
    const convResult = this.importConversations(zip);
    newRecords += convResult.newRecords;
    updatedRecords += convResult.updatedRecords;
    skippedRecords += convResult.skippedRecords;
    errorCount += convResult.errorCount;

    // --- Projects ---
    const projResult = this.importProjects(zip);
    newRecords += projResult.newRecords;
    updatedRecords += projResult.updatedRecords;
    skippedRecords += projResult.skippedRecords;
    errorCount += projResult.errorCount;

    // --- Memories ---
    const memResult = this.importMemories(zip);
    newRecords += memResult.newRecords;
    updatedRecords += memResult.updatedRecords;
    skippedRecords += memResult.skippedRecords;
    errorCount += memResult.errorCount;

    const summary: ImportSummary = {
      newRecords,
      updatedRecords,
      skippedRecords,
      errorCount,
      scanDurationMs: Date.now() - startTime,
      scannedAt: new Date().toISOString(),
    };

    console.log(
      `[chatExportImporter] Import complete: ${newRecords} new, ${updatedRecords} updated, ${skippedRecords} skipped, ${errorCount} errors (${summary.scanDurationMs}ms)`
    );

    return summary;
  }

  // -------------------------------------------------------------------------
  // Conversations
  // -------------------------------------------------------------------------

  private importConversations(zip: AdmZip): ImportCounts {
    const data = this.readJsonFromZip<ExportConversation[]>(zip, 'conversations.json');
    if (!data) return { newRecords: 0, updatedRecords: 0, skippedRecords: 0, errorCount: 0 };

    let newRecords = 0;
    let updatedRecords = 0;
    let skippedRecords = 0;
    let errorCount = 0;
    const now = new Date().toISOString();

    const upsert = this.db.prepare(`
      INSERT INTO chat_conversations (conversation_id, title, message_count, created_at, updated_at, imported_at)
      VALUES (@conversationId, @title, @messageCount, @createdAt, @updatedAt, @importedAt)
      ON CONFLICT(conversation_id) DO UPDATE SET
        title = excluded.title,
        message_count = excluded.message_count,
        updated_at = excluded.updated_at,
        imported_at = excluded.imported_at
    `);

    const checkExists = this.db.prepare<[string], { id: number; message_count: number | null }>(
      `SELECT id, message_count FROM chat_conversations WHERE conversation_id = ?`
    );

    const runAll = this.db.transaction(() => {
      for (const conv of data) {
        try {
          const messageCount = conv.chat_messages?.length ?? 0;
          const existing = checkExists.get(conv.uuid);

          upsert.run({
            conversationId: conv.uuid,
            title: conv.name || null,
            messageCount,
            createdAt: conv.created_at,
            updatedAt: conv.updated_at,
            importedAt: now,
          });

          if (existing) {
            if (existing.message_count !== messageCount) {
              updatedRecords++;
            } else {
              skippedRecords++;
            }
          } else {
            newRecords++;
          }
        } catch (err) {
          console.error(`[chatExportImporter] Failed to import conversation ${conv.uuid}:`, err);
          errorCount++;
        }
      }
    });

    runAll();
    console.log(`[chatExportImporter] Conversations: ${data.length} found, ${newRecords} new, ${updatedRecords} updated`);
    return { newRecords, updatedRecords, skippedRecords, errorCount };
  }

  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------

  private importProjects(zip: AdmZip): ImportCounts {
    const data = this.readJsonFromZip<ExportProject[]>(zip, 'projects.json');
    if (!data) return { newRecords: 0, updatedRecords: 0, skippedRecords: 0, errorCount: 0 };

    let newRecords = 0;
    let updatedRecords = 0;
    let skippedRecords = 0;
    let errorCount = 0;
    const now = new Date().toISOString();

    const upsert = this.db.prepare(`
      INSERT INTO chat_projects (project_id, name, description, is_private, doc_count, created_at, updated_at, imported_at)
      VALUES (@projectId, @name, @description, @isPrivate, @docCount, @createdAt, @updatedAt, @importedAt)
      ON CONFLICT(project_id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        is_private = excluded.is_private,
        doc_count = excluded.doc_count,
        updated_at = excluded.updated_at,
        imported_at = excluded.imported_at
    `);

    const checkExists = this.db.prepare<[string], { id: number; doc_count: number | null }>(
      `SELECT id, doc_count FROM chat_projects WHERE project_id = ?`
    );

    const runAll = this.db.transaction(() => {
      for (const proj of data) {
        try {
          const docCount = proj.docs?.length ?? 0;
          const existing = checkExists.get(proj.uuid);

          upsert.run({
            projectId: proj.uuid,
            name: proj.name || null,
            description: proj.description || null,
            isPrivate: proj.is_private ? 1 : 0,
            docCount,
            createdAt: proj.created_at,
            updatedAt: proj.updated_at,
            importedAt: now,
          });

          if (existing) {
            if (existing.doc_count !== docCount) {
              updatedRecords++;
            } else {
              skippedRecords++;
            }
          } else {
            newRecords++;
          }
        } catch (err) {
          console.error(`[chatExportImporter] Failed to import project ${proj.uuid}:`, err);
          errorCount++;
        }
      }
    });

    runAll();
    console.log(`[chatExportImporter] Projects: ${data.length} found, ${newRecords} new, ${updatedRecords} updated`);
    return { newRecords, updatedRecords, skippedRecords, errorCount };
  }

  // -------------------------------------------------------------------------
  // Memories
  // -------------------------------------------------------------------------

  private importMemories(zip: AdmZip): ImportCounts {
    const data = this.readJsonFromZip<ExportMemoryEntry[]>(zip, 'memories.json');
    if (!data) return { newRecords: 0, updatedRecords: 0, skippedRecords: 0, errorCount: 0 };

    let newRecords = 0;
    let updatedRecords = 0;
    let skippedRecords = 0;
    let errorCount = 0;
    const now = new Date().toISOString();

    const upsert = this.db.prepare(`
      INSERT INTO chat_memories (account_uuid, type, project_id, content_length, imported_at)
      VALUES (@accountUuid, @type, @projectId, @contentLength, @importedAt)
      ON CONFLICT(account_uuid, type, project_id) DO UPDATE SET
        content_length = excluded.content_length,
        imported_at = excluded.imported_at
    `);

    const checkExists = this.db.prepare<[string, string, string | null], { id: number; content_length: number | null }>(
      `SELECT id, content_length FROM chat_memories WHERE account_uuid = ? AND type = ? AND project_id IS ?`
    );

    const runAll = this.db.transaction(() => {
      for (const entry of data) {
        try {
          // Global conversation memory
          if (entry.conversations_memory != null) {
            const contentLength = entry.conversations_memory.length;
            const existing = checkExists.get(entry.account_uuid, 'conversation', null);

            upsert.run({
              accountUuid: entry.account_uuid,
              type: 'conversation',
              projectId: null,
              contentLength,
              importedAt: now,
            });

            if (existing) {
              if (existing.content_length !== contentLength) {
                updatedRecords++;
              } else {
                skippedRecords++;
              }
            } else {
              newRecords++;
            }
          }

          // Per-project memories
          if (entry.project_memories) {
            for (const [projectId, memoryText] of Object.entries(entry.project_memories)) {
              const contentLength = memoryText.length;
              const existing = checkExists.get(entry.account_uuid, 'project', projectId);

              upsert.run({
                accountUuid: entry.account_uuid,
                type: 'project',
                projectId,
                contentLength,
                importedAt: now,
              });

              if (existing) {
                if (existing.content_length !== contentLength) {
                  updatedRecords++;
                } else {
                  skippedRecords++;
                }
              } else {
                newRecords++;
              }
            }
          }
        } catch (err) {
          console.error(`[chatExportImporter] Failed to import memory for account ${entry.account_uuid}:`, err);
          errorCount++;
        }
      }
    });

    runAll();
    console.log(`[chatExportImporter] Memories: ${newRecords} new, ${updatedRecords} updated`);
    return { newRecords, updatedRecords, skippedRecords, errorCount };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private readJsonFromZip<T>(zip: AdmZip, filename: string): T | null {
    const entry = zip.getEntry(filename);
    if (!entry) {
      console.warn(`[chatExportImporter] ${filename} not found in ZIP, skipping`);
      return null;
    }
    try {
      const text = entry.getData().toString('utf-8');
      return JSON.parse(text) as T;
    } catch (err) {
      console.error(`[chatExportImporter] Failed to parse ${filename}:`, err);
      return null;
    }
  }
}

interface ImportCounts {
  newRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  errorCount: number;
}
