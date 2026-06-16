// TabCraft — Storage Manager
// Handles all data persistence via chrome.storage.local

import type { StorageSchema, Settings, DomainRule, Workspace, SnoozeRecord } from '../shared/types';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../shared/constants';

/** Get a value from storage */
async function get<K extends keyof StorageSchema>(key: K): Promise<StorageSchema[K] | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] ?? null);
    });
  });
}

/** Set a value in storage */
async function set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

/** Remove a key from storage */
async function remove(key: keyof StorageSchema): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(key, resolve);
  });
}

/** Storage manager singleton */
export const Storage = {
  /** Initialize storage with defaults */
  async init(): Promise<void> {
    const settings = await get('settings');
    if (!settings) {
      await set('settings', DEFAULT_SETTINGS);
    }
  },

  // ── Settings ──────────────────────────────────────────────

  async getSettings(): Promise<Settings> {
    return (await get('settings')) ?? DEFAULT_SETTINGS;
  },

  async updateSettings(partial: Partial<Settings>): Promise<void> {
    const current = await this.getSettings();
    await set('settings', { ...current, ...partial });
  },

  // ── Domain Rules ──────────────────────────────────────────

  async getRules(): Promise<DomainRule[]> {
    return (await get('rules')) ?? [];
  },

  async setRules(rules: DomainRule[]): Promise<void> {
    await set('rules', rules);
  },

  async addRule(rule: DomainRule): Promise<void> {
    const rules = await this.getRules();
    rules.push(rule);
    await set('rules', rules);
  },

  async updateRule(id: string, updates: Partial<DomainRule>): Promise<void> {
    const rules = await this.getRules();
    const idx = rules.findIndex(r => r.id === id);
    if (idx >= 0) {
      rules[idx] = { ...rules[idx], ...updates, updatedAt: Date.now() };
      await set('rules', rules);
    }
  },

  async deleteRule(id: string): Promise<void> {
    const rules = await this.getRules();
    await set('rules', rules.filter(r => r.id !== id));
  },

  // ── Workspaces ────────────────────────────────────────────

  async getWorkspaces(): Promise<Workspace[]> {
    return (await get('workspaces')) ?? [];
  },

  async saveWorkspace(workspace: Workspace): Promise<void> {
    const workspaces = await this.getWorkspaces();
    const idx = workspaces.findIndex(w => w.id === workspace.id);
    if (idx >= 0) {
      workspaces[idx] = workspace;
    } else {
      workspaces.push(workspace);
    }
    await set('workspaces', workspaces);
  },

  async deleteWorkspace(id: string): Promise<void> {
    const workspaces = await this.getWorkspaces();
    await set('workspaces', workspaces.filter(w => w.id !== id));
  },

  // ── Snooze ────────────────────────────────────────────────

  async getSnoozed(): Promise<SnoozeRecord[]> {
    return (await get('snoozed')) ?? [];
  },

  async addSnooze(record: SnoozeRecord): Promise<void> {
    const snoozed = await this.getSnoozed();
    snoozed.push(record);
    await set('snoozed', snoozed);
  },

  async removeSnooze(id: string): Promise<void> {
    const snoozed = await this.getSnoozed();
    await set('snoozed', snoozed.filter(s => s.id !== id));
  },

  // ── Learned Mappings ──────────────────────────────────────

  async getLearnedMappings(): Promise<Record<string, string>> {
    return (await get('learned')) ?? {};
  },

  async setLearnedMapping(domain: string, category: string): Promise<void> {
    const mappings = await this.getLearnedMappings();
    mappings[domain] = category;
    await set('learned', mappings);
  },

  // ── Session Snapshot ──────────────────────────────────────

  async getSessionSnapshot(): Promise<Workspace | null> {
    return (await get('session')) ?? null;
  },

  async setSessionSnapshot(workspace: Workspace): Promise<void> {
    await set('session', workspace);
  },

  async clearSessionSnapshot(): Promise<void> {
    await remove('session');
  },

  // ── Stats ─────────────────────────────────────────────────

  async getStats() {
    return (await get('stats')) ?? {
      totalGrouped: 0,
      totalHibernated: 0,
      totalDuplicatesClosed: 0,
    };
  },

  async incrementStat(key: 'totalGrouped' | 'totalHibernated' | 'totalDuplicatesClosed', count = 1) {
    const stats = await this.getStats();
    stats[key] += count;
    stats.lastGroupedAt = Date.now();
    await set('stats', stats);
  },

  // ── Export / Import ───────────────────────────────────────

  async exportAll(): Promise<string> {
    const data = await new Promise<Record<string, any>>((resolve) => {
      chrome.storage.local.get(null, resolve);
    });
    return JSON.stringify(data, null, 2);
  },

  async importAll(json: string): Promise<void> {
    const data = JSON.parse(json);
    return new Promise((resolve) => {
      chrome.storage.local.set(data, resolve);
    });
  },

  /** Clear all data */
  async clearAll(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  },
};
