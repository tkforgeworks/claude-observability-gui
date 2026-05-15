import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import type { AppSettings, DashboardConfig } from '../../shared/ipc-types';
import { DEFAULT_SETTINGS } from './defaultSettings';
import { DEFAULT_DASHBOARD } from './defaultDashboard';

const CONFIG_DIR_NAME = 'ClaudeUsageMonitor';
const SETTINGS_FILE = 'settings.json';
const DASHBOARD_FILE = 'dashboard.json';

function getConfigDir(): string {
  return path.join(app.getPath('userData'), CONFIG_DIR_NAME);
}

export function getSettingsPath(): string {
  return path.join(getConfigDir(), SETTINGS_FILE);
}

export function getDashboardPath(): string {
  return path.join(getConfigDir(), DASHBOARD_FILE);
}

function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string, defaults: T): T {
  if (!fs.existsSync(filePath)) {
    return defaults;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return { ...defaults, ...JSON.parse(raw) } as T;
  } catch (err) {
    console.error(`[configStore] Failed to read ${filePath}, using defaults:`, err);
    return defaults;
  }
}

function writeJsonFile<T>(filePath: string, data: T): void {
  ensureConfigDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function loadSettings(): AppSettings {
  return readJsonFile(getSettingsPath(), DEFAULT_SETTINGS);
}

export function saveSettings(settings: AppSettings): void {
  writeJsonFile(getSettingsPath(), settings);
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const merged = { ...current, ...partial };
  saveSettings(merged);
  return merged;
}

export function loadDashboard(): DashboardConfig {
  const config = readJsonFile<DashboardConfig>(getDashboardPath(), DEFAULT_DASHBOARD);
  // Merge in any new views added in code but missing from the user's saved config
  const existingIds = new Set(config.views.map(v => v.id));
  for (const defaultView of DEFAULT_DASHBOARD.views) {
    if (!existingIds.has(defaultView.id)) {
      config.views.push(defaultView);
    }
  }
  return config;
}

export function saveDashboard(config: DashboardConfig): void {
  writeJsonFile(getDashboardPath(), config);
}

export function resetDashboard(): DashboardConfig {
  writeJsonFile(getDashboardPath(), DEFAULT_DASHBOARD);
  return DEFAULT_DASHBOARD;
}

/**
 * Creates settings.json and dashboard.json with defaults if they don't exist.
 * Called once from main.ts on startup.
 */
export function ensureConfigFiles(): void {
  ensureConfigDir();

  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    writeJsonFile(settingsPath, DEFAULT_SETTINGS);
    console.log(`[configStore] Created ${settingsPath}`);
  }

  const dashboardPath = getDashboardPath();
  if (!fs.existsSync(dashboardPath)) {
    writeJsonFile(dashboardPath, DEFAULT_DASHBOARD);
    console.log(`[configStore] Created ${dashboardPath}`);
  }
}
