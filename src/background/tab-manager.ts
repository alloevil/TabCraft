// TabCraft — Tab Manager
// Core tab lifecycle management: grouping, deduplication, organization

import type { TabInfo, TabGroup, ClassificationResult } from '../shared/types';
import { GROUP_COLORS } from '../shared/types';
import { RuleEngine, extractDomain, getFriendlyName } from './ai/rule-engine';
import { GeminiNanoClassifier } from './ai/gemini-nano';
import { Storage } from './storage';
import { normalizeUrl } from './duplicate';

/** Get all tabs in the current window */
async function getAllTabs(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({ currentWindow: true });
}

/** Assign a color to a group based on its index */
function getColorForIndex(index: number): chrome.tabGroups.ColorEnum {
  return GROUP_COLORS[index % GROUP_COLORS.length];
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

  /** Smart group all tabs in the current window */
  async smartGroupAll(): Promise<{ grouped: number; groups: number }> {
    const tabs = await getAllTabs();
    const settings = await Storage.getSettings();

    // Classify all tabs
    const classifications = new Map<number, ClassificationResult>();
    for (const tab of tabs) {
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.pinned) {
        const result = await this.classifyTab(tab);
        classifications.set(tab.id!, result);
      }
    }

    // Group by category — unclassified tabs go into an "Other" group too,
    // so a single Smart Group click leaves no tab ungrouped in the native tab strip.
    const categoryTabs = new Map<string, number[]>();
    for (const [tabId, result] of classifications) {
      const existing = categoryTabs.get(result.category) || [];
      existing.push(tabId);
      categoryTabs.set(result.category, existing);
    }

    // Filter by minimum tabs per group, then sort so "Other" comes last
    const validGroups = Array.from(categoryTabs.entries())
      .filter(([, tabIds]) => tabIds.length >= settings.minTabsPerGroup)
      .sort(([a], [b]) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return 0;
      });

    // Create Chrome tab groups
    let groupCount = 0;
    for (const [category, tabIds] of validGroups) {
      try {
        const groupId = await chrome.tabs.group({ tabIds });
        // "Other" always grey; real categories cycle through the palette
        const color = category === 'Other' ? 'grey' : getColorForIndex(groupCount);
        await chrome.tabGroups.update(groupId, {
          title: category,
          color,
          collapsed: false,
        });
        groupCount++;
      } catch (err) {
        console.error(`[TabCraft] Failed to group "${category}":`, err);
      }
    }

    // Update stats
    await Storage.incrementStat('totalGrouped', tabs.length);

    return {
      grouped: tabs.filter(t => !t.url?.startsWith('chrome://')).length,
      groups: groupCount,
    };
  }

  /** Auto-group a single new tab into an existing group */
  async autoGroupTab(tab: chrome.tabs.Tab): Promise<void> {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.pinned) return;

    const settings = await Storage.getSettings();
    if (!settings.autoGroup) return;

    const result = await this.classifyTab(tab);
    if (result.category === 'Other') return;

    // Find existing group with matching name
    const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
    const existingGroup = groups.find(g => g.title === result.category);

    if (existingGroup) {
      // Add to existing group
      await chrome.tabs.group({ tabIds: tab.id!, groupId: existingGroup.id });
    } else if (settings.groupingMode === 'smart') {
      // Check if there are enough ungrouped tabs of this category to form a new group
      const allTabs = await getAllTabs();
      const sameCategory = [];
      for (const t of allTabs) {
        if (t.url && !t.url.startsWith('chrome://') && !t.pinned && t.groupId === -1) {
          const r = await this.classifyTab(t);
          if (r.category === result.category) {
            sameCategory.push(t.id!);
          }
        }
      }
      if (sameCategory.length >= settings.minTabsPerGroup) {
        const groupId = await chrome.tabs.group({ tabIds: sameCategory });
        const color = getColorForIndex(groups.length);
        await chrome.tabGroups.update(groupId, {
          title: result.category,
          color,
        });
      }
    }
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
