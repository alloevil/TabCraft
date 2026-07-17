// TabCraft — Storage Manager
// Handles all data persistence via chrome.storage.local

import type { StorageSchema, Settings, DomainRule, Workspace, SnoozeRecord } from '../shared/types';
import { STORAGE_KEYS, DEFAULT_SETTINGS, MAX_UNDO_HISTORY, MAX_LEARNED_MAPPINGS } from '../shared/constants';

/** Raw storage key for undo snapshots (intentionally outside StorageSchema). */
const UNDO_KEY = 'undoStack';

/** A snapshot of the tab→group layout, used to undo a grouping action. */
export interface UndoSnapshot {
  tabs: Array<{ tabId: number; groupId: number }>;
  groupMeta: Record<number, { title: string; color: string }>;
  createdAt: number;
}

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

/** Per-key write serialization.
 *
 *  MV3 background listeners can run concurrently — e.g. two `onUpdated`
 *  events resolving out of order, or a message handler and an alarm firing
 *  close together. Every mutator below is read-modify-write (get the whole
 *  array/object, mutate, set it back), so two concurrent calls touching the
 *  same key can both read the same snapshot and the second write silently
 *  clobbers the first (a lost increment, a lost rule, etc.). `withLock`
 *  chains same-key operations into a queue so each one sees the previous
 *  one's result before it runs. Different keys are independent — updating
 *  `stats` never waits on `rules`. */
const keyLocks = new Map<string, Promise<unknown>>();

function withLock<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
  const prevTail = keyLocks.get(lockKey) ?? Promise.resolve();
  const run = prevTail.then(fn, fn);
  // The stored tail must always settle (never reject) so a failed operation
  // doesn't permanently jam the queue for later calls on the same key.
  keyLocks.set(lockKey, run.then(() => undefined, () => undefined));
  return run;
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
    return withLock('settings', async () => {
      const current = await this.getSettings();
      await set('settings', { ...current, ...partial });
    });
  },

  // ── Domain Rules ──────────────────────────────────────────

  async getRules(): Promise<DomainRule[]> {
    return (await get('rules')) ?? [];
  },

  async setRules(rules: DomainRule[]): Promise<void> {
    await set('rules', rules);
  },

  async addRule(rule: DomainRule): Promise<void> {
    return withLock('rules', async () => {
      const rules = await this.getRules();
      rules.push(rule);
      await set('rules', rules);
    });
  },

  async updateRule(id: string, updates: Partial<DomainRule>): Promise<void> {
    return withLock('rules', async () => {
      const rules = await this.getRules();
      const idx = rules.findIndex(r => r.id === id);
      if (idx >= 0) {
        rules[idx] = { ...rules[idx], ...updates, updatedAt: Date.now() };
        await set('rules', rules);
      }
    });
  },

  async deleteRule(id: string): Promise<void> {
    return withLock('rules', async () => {
      const rules = await this.getRules();
      await set('rules', rules.filter(r => r.id !== id));
    });
  },

  // ── Workspaces ────────────────────────────────────────────

  async getWorkspaces(): Promise<Workspace[]> {
    return (await get('workspaces')) ?? [];
  },

  async saveWorkspace(workspace: Workspace): Promise<void> {
    return withLock('workspaces', async () => {
      const workspaces = await this.getWorkspaces();
      const idx = workspaces.findIndex(w => w.id === workspace.id);
      if (idx >= 0) {
        workspaces[idx] = workspace;
      } else {
        workspaces.push(workspace);
      }
      await set('workspaces', workspaces);
    });
  },

  async deleteWorkspace(id: string): Promise<void> {
    return withLock('workspaces', async () => {
      const workspaces = await this.getWorkspaces();
      await set('workspaces', workspaces.filter(w => w.id !== id));
    });
  },

  // ── Snooze ────────────────────────────────────────────────

  async getSnoozed(): Promise<SnoozeRecord[]> {
    return (await get('snoozed')) ?? [];
  },

  async addSnooze(record: SnoozeRecord): Promise<void> {
    return withLock('snoozed', async () => {
      const snoozed = await this.getSnoozed();
      snoozed.push(record);
      await set('snoozed', snoozed);
    });
  },

  async removeSnooze(id: string): Promise<void> {
    return withLock('snoozed', async () => {
      const snoozed = await this.getSnoozed();
      await set('snoozed', snoozed.filter(s => s.id !== id));
    });
  },

  // ── Learned Mappings ──────────────────────────────────────

  async getLearnedMappings(): Promise<Record<string, string>> {
    return (await get('learnedMappings')) ?? {};
  },

  async setLearnedMapping(domain: string, category: string): Promise<void> {
    await this.addLearnedMappings([{ domain, category }]);
  },

  /** Add several domain→category mappings in one storage write.
   *  Used by AI result feedback so a batch of tabs costs one write, not N.
   *  Same LRU semantics as setLearnedMapping: re-inserting a domain refreshes
   *  its recency; the oldest entries are evicted past MAX_LEARNED_MAPPINGS. */
  async addLearnedMappings(entries: Array<{ domain: string; category: string }>): Promise<void> {
    if (entries.length === 0) return;
    return withLock('learnedMappings', async () => {
      const mappings = await this.getLearnedMappings();
      for (const { domain, category } of entries) {
        if (!domain) continue;
        delete mappings[domain];        // move to most-recently-used position
        mappings[domain] = category;
      }
      const keys = Object.keys(mappings);
      if (keys.length > MAX_LEARNED_MAPPINGS) {
        for (const old of keys.slice(0, keys.length - MAX_LEARNED_MAPPINGS)) {
          delete mappings[old];
        }
      }
      await set('learnedMappings', mappings);
    });
  },

  /** Number of learned domain→category mappings currently stored. */
  async getLearnedMappingCount(): Promise<number> {
    return Object.keys(await this.getLearnedMappings()).length;
  },

  /** Forget all learned mappings (user-initiated reset). */
  async clearLearnedMappings(): Promise<void> {
    return withLock('learnedMappings', async () => {
      await set('learnedMappings', {});
    });
  },

  // ── Session Snapshot ──────────────────────────────────────

  async getSessionSnapshot(): Promise<Workspace | null> {
    return (await get('sessionSnapshot')) ?? null;
  },

  async setSessionSnapshot(workspace: Workspace): Promise<void> {
    await set('sessionSnapshot', workspace);
  },

  async clearSessionSnapshot(): Promise<void> {
    await remove('sessionSnapshot');
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
    return withLock('stats', async () => {
      const stats = await this.getStats();
      stats[key] += count;
      stats.lastGroupedAt = Date.now();
      await set('stats', stats);
    });
  },

  // ── Undo snapshots ────────────────────────────────────────
  // Kept outside StorageSchema (raw key) so the typed get/set stay simple.

  async pushUndoSnapshot(snapshot: UndoSnapshot): Promise<void> {
    return withLock(UNDO_KEY, async () => {
      const stack = await this.getUndoStack();
      stack.push(snapshot);
      // Cap history depth
      while (stack.length > MAX_UNDO_HISTORY) stack.shift();
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [UNDO_KEY]: stack }, () => resolve());
      });
    });
  },

  async popUndoSnapshot(): Promise<UndoSnapshot | null> {
    return withLock(UNDO_KEY, async () => {
      const stack = await this.getUndoStack();
      const snapshot = stack.pop() ?? null;
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [UNDO_KEY]: stack }, () => resolve());
      });
      return snapshot;
    });
  },

  async getUndoStack(): Promise<UndoSnapshot[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get(UNDO_KEY, (result) => resolve(result[UNDO_KEY] ?? []));
    });
  },

  async hasUndo(): Promise<boolean> {
    return (await this.getUndoStack()).length > 0;
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
