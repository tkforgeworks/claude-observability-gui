/**
 * Writes unmatched (but structured) log lines to a rotating file for debugging.
 * Lines that don't match any known event pattern are funneled here instead of
 * cluttering the console.
 *
 * Rotation: when the current file exceeds MAX_FILE_SIZE, it is renamed to .1
 * and a new file is started. Only one backup is kept.
 *
 * @see CGUI-14
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const LOG_FILE_NAME = 'logwatcher-unmatched.log';
const BACKUP_SUFFIX = '.1';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

let logFilePath: string | null = null;
let currentSize = 0;

function getLogFilePath(): string {
  if (!logFilePath) {
    logFilePath = path.join(app.getPath('userData'), LOG_FILE_NAME);
    // Seed currentSize from existing file
    try {
      const stat = fs.statSync(logFilePath);
      currentSize = stat.size;
    } catch {
      currentSize = 0;
    }
  }
  return logFilePath;
}

function rotate(): void {
  const filePath = getLogFilePath();
  const backupPath = filePath + BACKUP_SUFFIX;

  try {
    // Remove old backup if it exists
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
    // Rename current to backup
    if (fs.existsSync(filePath)) {
      fs.renameSync(filePath, backupPath);
    }
    currentSize = 0;
  } catch (err) {
    console.error('[unmatchedLogWriter] Rotation failed:', err);
  }
}

/**
 * Appends an unmatched log line to the unmatched log file.
 * Rotates when the file exceeds 5 MB.
 */
export function writeUnmatchedLine(line: string): void {
  if (currentSize >= MAX_FILE_SIZE) {
    rotate();
  }

  const filePath = getLogFilePath();
  const entry = line + '\n';

  try {
    fs.appendFileSync(filePath, entry, 'utf-8');
    currentSize += Buffer.byteLength(entry, 'utf-8');
  } catch (err) {
    // Silently fail — this is a debug log, not critical
  }
}
