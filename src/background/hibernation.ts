// TabCraft — Tab Hibernation
// Automatically suspends inactive tabs to save memory
// Uses chrome.alarms for MV3 reliability + chrome.storage for state persistence

import { Storage } from './storage';
import { LAST_ACCESS_FLUSH_DEBOUNCE_MS } from '../shared/constants';
import { formatMemoryEstimate } from '../shared/format';

const LAST_ACCESS_KEY = 'hibernation_lastAccess';

/** Check if a tab should be excluded from hibernation */
function shouldExclude(tab: chrome.tabs.Tab): boolean {
  if (tab.pinned) return true;
  if (tab.active) return true;
  if (tab.audible) return true;
  if (tab.url?.startsWith('chrome://')) return true;
  if (tab.status === 'loading') return true;
  return false;
}

/**
 * Hibernation Manager
 * Uses chrome.alarms for periodic checks (MV3-safe)
 * Uses chrome.storage.local for lastAccessMap persistence
 */
export class HibernationManager {
  /** In-memory mirror of the last-access map. Tab-activity events mutate
   *  this directly instead of doing a full storage read-modify-write on
   *  every activation/navigation; writes are flushed to storage on a
   *  trailing debounce (see scheduleFlush). */
  private lastAccessCache: Record<number, number> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  /** Start monitoring tab activity */
  start(): void {
    // Track tab activation
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.updateLastAccess(activeInfo.tabId);
    });

    // Track tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === 'complete') {
        this.updateLastAccess(tabId);
      }
    });

    // Remove closed tabs from tracking
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.removeLastAccess(tabId);
    });

    // Periodic check is handled by chrome.alarms in index.ts
  }

  /** Lazily load the last-access map into memory (once per service-worker
   *  lifetime — MV3 workers are recreated often, so this still runs
   *  regularly, but no longer once per tab event). */
  private async ensureCacheLoaded(): Promise<Record<number, number>> {
    if (!this.lastAccessCache) {
      this.lastAccessCache = await new Promise((resolve) => {
        chrome.storage.local.get(LAST_ACCESS_KEY, (result) => {
          resolve(result[LAST_ACCESS_KEY] || {});
        });
      });
    }
    return this.lastAccessCache!;
  }

  /** Debounced flush of the in-memory cache to storage. */
  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.lastAccessCache) {
        chrome.storage.local.set({ [LAST_ACCESS_KEY]: this.lastAccessCache });
      }
    }, LAST_ACCESS_FLUSH_DEBOUNCE_MS);
  }

  /** Update last access time for a tab */
  private async updateLastAccess(tabId: number): Promise<void> {
    const data = await this.ensureCacheLoaded();
    data[tabId] = Date.now();
    this.scheduleFlush();
  }

  /** Remove a tab from last access tracking */
  private async removeLastAccess(tabId: number): Promise<void> {
    const data = await this.ensureCacheLoaded();
    delete data[tabId];
    this.scheduleFlush();
  }

  /** Get the last access map, loading it from storage on first use. */
  private async getLastAccessMap(): Promise<Record<number, number>> {
    return this.ensureCacheLoaded();
  }

  /** Check all tabs and hibernate inactive ones */
  async checkAndHibernate(): Promise<number> {
    const settings = await Storage.getSettings();
    const timeoutMs = settings.hibernationTimeout * 60 * 1000;
    const now = Date.now();
    const lastAccessMap = await this.getLastAccessMap();

    const tabs = await chrome.tabs.query({ currentWindow: true });
    let hibernated = 0;

    for (const tab of tabs) {
      if (!tab.id || shouldExclude(tab)) continue;

      const lastAccess = lastAccessMap[tab.id] || tab.lastAccessed || 0;
      const inactiveTime = now - lastAccess;

      if (inactiveTime > timeoutMs && !tab.discarded) {
        try {
          await chrome.tabs.discard(tab.id);
          hibernated++;
        } catch (err) {
          console.debug(`[TabCraft] Cannot discard tab ${tab.id}:`, err);
        }
      }
    }

    if (hibernated > 0) {
      await Storage.incrementStat('totalHibernated', hibernated);
      console.log(`[TabCraft] Hibernated ${hibernated} inactive tabs`);
    }

    return hibernated;
  }

  /** Manually hibernate all inactive tabs */
  async hibernateAllInactive(): Promise<number> {
    return this.checkAndHibernate();
  }

  /** Hibernate a specific tab */
  async hibernateTab(tabId: number): Promise<boolean> {
    try {
      await chrome.tabs.discard(tabId);
      await Storage.incrementStat('totalHibernated');
      return true;
    } catch {
      return false;
    }
  }

  /** Get hibernation stats */
  async getStats(): Promise<{ hibernated: number; total: number; memorySaved: string }> {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const hibernated = tabs.filter(t => t.discarded).length;
    const total = tabs.length;

    // Note: actual memory savings vary by tab content — this is a rough
    // estimate for display purposes only (see ESTIMATED_MB_PER_TAB).
    const memorySaved = formatMemoryEstimate(hibernated);

    return { hibernated, total, memorySaved };
  }
}
