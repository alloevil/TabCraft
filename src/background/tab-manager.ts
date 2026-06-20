// TabCraft — Tab Manager
// Core tab lifecycle management: grouping, deduplication, organization

import type { ClassificationResult } from '../shared/types';
import { colorForCategory } from '../shared/types';
import { RuleEngine, extractDomain, getFriendlyName } from './ai/rule-engine';
import { GeminiNanoClassifier } from './ai/gemini-nano';
import { Storage } from './storage';
import { normalizeUrl } from './duplicate';

/** Get all tabs in the current window */
async function getAllTabs(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({ currentWindow: true });
}

/**
 * Tab Manager — orchestrates tab grouping, dedup, and organization
 */
export class TabManager {
  private ruleEngine: RuleEngine;
  private aiClassifier: GeminiNanoClassifier;
  private aiReady = false;

  constructor() {
    this.ruleEngine = new RuleEngine();
    this.aiClassifier = new GeminiNanoClassifier();
  }

  /** Initialize the tab manager */
  async init(): Promise<void> {
    // Load rules from storage
    const rules = await Storage.getRules();
    if (rules.length > 0) {
      this.ruleEngine.loadRules(rules);
    }

    // Load learned mappings
    const learned = await Storage.getLearnedMappings();
    this.ruleEngine.setLearnedMappings(learned);

    // Try to init AI
    this.aiReady = await this.aiClassifier.init();
    console.log(`[TabCraft] AI ready: ${this.aiReady}`);
  }

  /** Classify a single tab */
  async classifyTab(tab: chrome.tabs.Tab): Promise<ClassificationResult> {
    const url = tab.url || '';
    const title = tab.title || '';

    // Try AI first
    if (this.aiReady) {
      const aiResult = await this.aiClassifier.classify(url, title);
      if (aiResult.confidence > 0.7) {
        return aiResult;
      }
    }

    // Fallback to rule engine
    return this.ruleEngine.classify(url, title);
  }

  /** Learn a domain→category mapping from the user's manual grouping action.
   *  Only active when the user enabled "learn from activity". This is what makes
   *  the rule engine improve over time instead of staying static. */
  async learnFromManualGrouping(tab: chrome.tabs.Tab, groupTitle: string): Promise<void> {
    const settings = await Storage.getSettings();
    if (!settings.learnFromActivity) return;
    if (!tab.url || !groupTitle.trim() || groupTitle === 'Other') return;

    const domain = extractDomain(tab.url);
    if (!domain) return;

    await Storage.setLearnedMapping(domain, groupTitle);
    // Refresh in-memory engine so the next classify picks it up immediately.
    const learned = await Storage.getLearnedMappings();
    this.ruleEngine.setLearnedMappings(learned);
  }

  /** Decide which group bucket a tab belongs to, honoring grouping mode.
   *  Shared by smartGroupAll and autoGroupTab so both behave identically. */
  async bucketForTab(tab: chrome.tabs.Tab, mode: 'smart' | 'domain'): Promise<string> {
    if (mode === 'domain') {
      const domain = extractDomain(tab.url || '');
      return domain ? (getFriendlyName(domain) || domain) : 'Other';
    }
    const result = await this.classifyTab(tab);
    return result.category;
  }

  /** Classify many tabs at once, returning a tabId→bucket map.
   *
   *  Two-phase to keep AI calls minimal while preserving the "rules first,
   *  AI fills the gaps" semantics:
   *    1. Run the (synchronous, free) rule engine on every tab. Confident
   *       hits (source === 'rule') are locked in immediately.
   *    2. Only the tabs the rules were unsure about (source === 'fallback')
   *       are sent to the AI — in a SINGLE batch call, not one per tab.
   *  In domain mode AI is never involved. */
  async classifyAllTabs(
    tabs: chrome.tabs.Tab[],
    mode: 'smart' | 'domain'
  ): Promise<Map<number, string>> {
    const buckets = new Map<number, string>();

    if (mode === 'domain') {
      for (const tab of tabs) {
        if (tab.id == null) continue;
        const domain = extractDomain(tab.url || '');
        buckets.set(tab.id, domain ? (getFriendlyName(domain) || domain) : 'Other');
      }
      return buckets;
    }

    // Phase 1 — rule engine for everyone.
    const needsAi: chrome.tabs.Tab[] = [];
    for (const tab of tabs) {
      if (tab.id == null) continue;
      const result = this.ruleEngine.classify(tab.url || '', tab.title || '');
      buckets.set(tab.id, result.category);
      // 'fallback' = keyword guess or default "Other" — uncertain, ask AI.
      if (result.source === 'fallback') needsAi.push(tab);
    }

    // Phase 2 — one batch AI call for the uncertain remainder.
    if (this.aiReady && needsAi.length > 0) {
      const batch = needsAi.map(t => ({ url: t.url || '', title: t.title || '' }));
      const aiResults = await this.aiClassifier.classifyBatch(batch);
      needsAi.forEach((tab, i) => {
        const ai = aiResults[i];
        // Only override the rule fallback when the AI is actually confident.
        if (ai && ai.confidence > 0.7 && ai.category) {
          buckets.set(tab.id!, ai.category);
        }
      });
    }

    return buckets;
  }

  /** Smart group all tabs in the current window */
  async smartGroupAll(): Promise<{ grouped: number; groups: number }> {
    const tabs = await getAllTabs();
    const settings = await Storage.getSettings();

    // Snapshot current grouping so the user can undo this action.
    await this.saveUndoSnapshot(tabs);

    // Classify all groupable tabs up front (one batch AI call, not N).
    const groupable = tabs.filter(
      t => t.url && !t.url.startsWith('chrome://') && !t.pinned
    );
    const tabBuckets = await this.classifyAllTabs(groupable, settings.groupingMode);

    // Bucket tabs into groups — by category (smart) or by domain (domain mode).
    // Unclassified tabs land in an "Other" group so one click leaves nothing
    // ungrouped in the native tab strip.
    const groupTabs = new Map<string, number[]>();
    for (const tab of groupable) {
      const bucket = tabBuckets.get(tab.id!) || 'Other';
      const existing = groupTabs.get(bucket) || [];
      existing.push(tab.id!);
      groupTabs.set(bucket, existing);
    }

    // Filter by minimum tabs per group, then sort so "Other" comes last
    const validGroups = Array.from(groupTabs.entries())
      .filter(([, tabIds]) => tabIds.length >= settings.minTabsPerGroup)
      .sort(([a], [b]) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return 0;
      });

    // Reuse existing same-named groups instead of always creating new ones
    const existingGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });

    let groupCount = 0;
    let groupedTabCount = 0;
    for (const [name, tabIds] of validGroups) {
      try {
        const existing = existingGroups.find(g => g.title === name);
        const groupId = existing
          ? await chrome.tabs.group({ tabIds, groupId: existing.id })
          : await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, {
          title: name,
          color: colorForCategory(name),
          collapsed: false,
        });
        groupCount++;
        groupedTabCount += tabIds.length;
      } catch (err) {
        console.error(`[TabCraft] Failed to group "${name}":`, err);
      }
    }

    // Stats: count tabs actually placed into groups, not the whole window
    await Storage.incrementStat('totalGrouped', groupedTabCount);

    return {
      grouped: groupedTabCount,
      groups: groupCount,
    };
  }

  /** Auto-group a single new tab into an existing group */
  async autoGroupTab(tab: chrome.tabs.Tab): Promise<void> {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.pinned) return;

    const settings = await Storage.getSettings();
    if (!settings.autoGroup) return;

    const bucket = await this.bucketForTab(tab, settings.groupingMode);

    // Find existing group with matching name
    const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
    const existingGroup = groups.find(g => g.title === bucket);

    if (existingGroup) {
      // Add to existing group
      await chrome.tabs.group({ tabIds: tab.id!, groupId: existingGroup.id });
    } else {
      // No existing group — form one if enough ungrouped tabs share this bucket.
      // Classify all ungrouped candidates in one batch instead of one AI call
      // per tab.
      const allTabs = await getAllTabs();
      const candidates = allTabs.filter(
        t => t.url && !t.url.startsWith('chrome://') && !t.pinned && t.groupId === -1
      );
      const candidateBuckets = await this.classifyAllTabs(candidates, settings.groupingMode);
      const sameBucket: number[] = [];
      for (const t of candidates) {
        if (candidateBuckets.get(t.id!) === bucket) sameBucket.push(t.id!);
      }
      if (sameBucket.length >= settings.minTabsPerGroup) {
        const groupId = await chrome.tabs.group({ tabIds: sameBucket });
        await chrome.tabGroups.update(groupId, {
          title: bucket,
          color: colorForCategory(bucket),
        });
      }
    }
  }

  // ── Undo ────────────────────────────────────────────────

  /** Save a snapshot of the current tab→group layout for undo. */
  private async saveUndoSnapshot(tabs: chrome.tabs.Tab[]): Promise<void> {
    try {
      const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      const groupMeta: Record<number, { title: string; color: string }> = {};
      for (const g of groups) groupMeta[g.id] = { title: g.title || '', color: g.color };
      const snapshot = tabs
        .filter(t => t.id != null)
        .map(t => ({ tabId: t.id!, groupId: t.groupId ?? -1 }));
      await Storage.pushUndoSnapshot({ tabs: snapshot, groupMeta, createdAt: Date.now() });
    } catch (err) {
      console.debug('[TabCraft] Failed to save undo snapshot:', err);
    }
  }

  /** Undo the most recent grouping action — restore tabs to their prior groups. */
  async undoLastGrouping(): Promise<boolean> {
    const snapshot = await Storage.popUndoSnapshot();
    if (!snapshot) return false;

    // First, ungroup every tab in the snapshot to a clean slate.
    const tabIds = snapshot.tabs.map(t => t.tabId);
    try {
      await chrome.tabs.ungroup(tabIds);
    } catch (err) {
      console.debug('[TabCraft] Undo ungroup failed (some tabs may be gone):', err);
    }

    // Rebuild the prior groups: collect tabs that belonged to each old group id.
    const byGroup = new Map<number, number[]>();
    for (const { tabId, groupId } of snapshot.tabs) {
      if (groupId === -1) continue;
      const arr = byGroup.get(groupId) || [];
      arr.push(tabId);
      byGroup.set(groupId, arr);
    }

    for (const [oldGroupId, ids] of byGroup) {
      try {
        const newGroupId = await chrome.tabs.group({ tabIds: ids });
        const meta = snapshot.groupMeta[oldGroupId];
        if (meta) {
          await chrome.tabGroups.update(newGroupId, {
            title: meta.title,
            color: meta.color as chrome.tabGroups.ColorEnum,
          });
        }
      } catch (err) {
        console.debug('[TabCraft] Undo regroup failed:', err);
      }
    }
    return true;
  }

  /** Detect and return duplicate tabs */
  async findDuplicates(): Promise<Array<{ url: string; tabs: chrome.tabs.Tab[] }>> {
    const tabs = await getAllTabs();
    const urlMap = new Map<string, chrome.tabs.Tab[]>();

    for (const tab of tabs) {
      if (!tab.url || tab.url.startsWith('chrome://')) continue;
      const normalized = normalizeUrl(tab.url);
      const existing = urlMap.get(normalized) || [];
      existing.push(tab);
      urlMap.set(normalized, existing);
    }

    return Array.from(urlMap.entries())
      .filter(([, tabs]) => tabs.length > 1)
      .map(([url, tabs]) => ({ url, tabs }));
  }

  /** Close all duplicate tabs (keep one) */
  async closeDuplicates(): Promise<number> {
    const duplicates = await this.findDuplicates();
    let closed = 0;

    for (const { tabs } of duplicates) {
      // Keep the most recently active tab, close the rest
      const sorted = tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
      const toClose = sorted.slice(1);
      for (const tab of toClose) {
        await chrome.tabs.remove(tab.id!);
        closed++;
      }
    }

    await Storage.incrementStat('totalDuplicatesClosed', closed);
    return closed;
  }

  /** Get domain stats for the dashboard */
  async getDomainStats(): Promise<Map<string, number>> {
    const tabs = await getAllTabs();
    const stats = new Map<string, number>();

    for (const tab of tabs) {
      if (!tab.url) continue;
      const domain = extractDomain(tab.url);
      if (domain) {
        stats.set(domain, (stats.get(domain) || 0) + 1);
      }
    }

    return stats;
  }

  /** Get friendly name for a tab's domain */
  getTabDisplayName(tab: chrome.tabs.Tab): string {
    if (!tab.url) return tab.title || 'Untitled';
    const domain = extractDomain(tab.url);
    return getFriendlyName(domain) || tab.title || domain || 'Untitled';
  }

  /** Is the AI engine ready? */
  isAiReady(): boolean {
    return this.aiReady;
  }

  /** Cleanup */
  destroy(): void {
    this.aiClassifier.destroy();
  }
}
