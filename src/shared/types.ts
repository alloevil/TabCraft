// TabCraft — Shared Types

/** Timer handle for the running environment (browser: number; Node lib
 *  types under vitest: Timeout). Named once here so consumers don't each
 *  re-derive it from setTimeout's signature. */
export type TimerHandle = ReturnType<typeof setTimeout>;

/** A browser tab with extended metadata */
export interface TabInfo {
  id: number;
  windowId: number;
  url: string;
  title: string;
  favIconUrl?: string;
  groupId?: number;
  pinned: boolean;
  active: boolean;
  lastAccessed: number; // timestamp
  createdAt: number; // timestamp
  discarded: boolean; // hibernated?
  status: string;
}

/** A group of tabs */
export interface TabGroup {
  id: string; // uuid
  name: string;
  color: chrome.tabGroups.ColorEnum;
  collapsed: boolean;
  tabIds: number[];
  createdAt: number;
  updatedAt: number;
  source: 'ai' | 'rule' | 'manual';
}

/** Domain categorization rule */
export interface DomainRule {
  id: string;
  domain: string;
  category: string;
  source: 'seed' | 'user' | 'learned';
  createdAt: number;
  updatedAt: number;
  /** Social feeds, UGC video, Q&A/blogging aggregators — per-page topic
   *  varies far more than the domain implies. RuleEngine defers to the
   *  tab's own title keywords before falling back to this rule's category. */
  multiPurpose?: boolean;
}

/** Corner the in-page proxy badge docks to. */
export type ProxyBadgePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** User preferences */
export interface Settings {
  autoGroup: boolean;
  minTabsPerGroup: number;
  autoCloseDuplicates: boolean;
  showDuplicateBadge: boolean;
  groupingMode: 'smart' | 'domain';
  hibernationTimeout: number; // minutes
  theme: 'system' | 'light' | 'dark';
  aiProvider: 'gemini-nano' | 'rule-engine';
  learnFromActivity: boolean;
  language: 'en' | 'zh';
  /** Show a pill on every page naming the proxy node that page's traffic
   *  actually egressed through. Off by default — it needs the optional
   *  <all_urls> host permission, which is requested only on opt-in. */
  showProxyBadge: boolean;
  /** Clash / mihomo external-controller address, e.g. http://127.0.0.1:9097. */
  proxyApiUrl: string;
  /** Controller secret, sent as a Bearer token. Stored in chrome.storage.local
   *  alongside every other setting; never synced, never sent anywhere else. */
  proxyApiSecret: string;
  proxyBadgePosition: ProxyBadgePosition;
}

/** AI classification result */
export interface ClassificationResult {
  category: string;
  confidence: number;
  source: 'ai' | 'rule' | 'fallback';
}

/** Tab snooze record */
export interface SnoozeRecord {
  id: string;
  tabId?: number;
  groupId?: number;
  url: string;
  title: string;
  wakeAt: number; // timestamp
  createdAt: number;
}

/** Workspace snapshot */
export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  tabs: WorkspaceTab[];
  groups: WorkspaceGroup[];
}

export interface WorkspaceTab {
  url: string;
  title: string;
  pinned: boolean;
  groupIndex: number;
}

export interface WorkspaceGroup {
  name: string;
  color: chrome.tabGroups.ColorEnum;
  collapsed: boolean;
}

/** Storage schema */
export interface StorageSchema {
  settings: Settings;
  rules: DomainRule[];
  workspaces: Workspace[];
  snoozed: SnoozeRecord[];
  learnedMappings: Record<string, string>; // domain -> category
  sessionSnapshot?: Workspace;
  stats: {
    totalGrouped: number;
    totalHibernated: number;
    totalDuplicatesClosed: number;
    lastGroupedAt?: number;
  };
}

/** Supported category names */
export const CATEGORIES = [
  'Development',
  'Social',
  'Work',
  'Shopping',
  'News',
  'Entertainment',
  'Finance',
  'Education',
  'Research',
  'Reference',
  'Travel',
  'Health',
  'AI & ML',
  'Gaming',
  'Music',
  'Video',
  'Design',
  'Communication',
  'Cloud & DevOps',
  'Security',
  'Other',
] as const;

export type CategoryName = (typeof CATEGORIES)[number];

/** Group color palette */
export const GROUP_COLORS: chrome.tabGroups.ColorEnum[] = [
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
  'grey',
];

/** Stable category → color map. A given category always gets the same color
 *  across re-groupings, so users build muscle memory. Categories not listed
 *  here fall back to a deterministic hash of their name (see colorForCategory). */
export const CATEGORY_COLORS: Record<string, chrome.tabGroups.ColorEnum> = {
  Development: 'blue',
  'AI & ML': 'purple',
  'Cloud & DevOps': 'cyan',
  Social: 'pink',
  Work: 'green',
  Communication: 'green',
  Shopping: 'orange',
  Finance: 'green',
  News: 'red',
  Entertainment: 'red',
  Music: 'pink',
  Video: 'red',
  Gaming: 'purple',
  Design: 'orange',
  Research: 'cyan',
  Education: 'yellow',
  Reference: 'yellow',
  Travel: 'cyan',
  Health: 'green',
  Security: 'red',
  Other: 'grey',
};

/** Deterministic color for any category name — stable across sessions. */
export function colorForCategory(category: string): chrome.tabGroups.ColorEnum {
  const mapped = CATEGORY_COLORS[category];
  if (mapped) return mapped;
  // Hash the name so unknown categories (e.g. domain-mode group names) still
  // get a stable, repeatable color instead of shifting with group order.
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  }
  // Avoid grey (reserved for "Other") for hashed colors
  const palette = GROUP_COLORS.filter((c) => c !== 'grey');
  return palette[hash % palette.length];
}

/** Background message protocol. One discriminated union shared by every
 *  sender: the background's handleMessage() switches exhaustively over
 *  `action`, and the side panel's sendMessage() helper only accepts these
 *  shapes — a typo'd action or missing payload fails to compile instead of
 *  hitting the runtime "Unknown action" reply. (`proxyForHost` is also sent by
 *  the injected page badge, which builds the literal by hand because injected
 *  code cannot import anything.) */
export type Message =
  | { action: 'smartGroup' }
  | { action: 'previewCustomCategories'; instruction: string }
  | { action: 'smartGroupCustom'; instruction: string; categories?: string[] }
  | { action: 'undoGrouping' }
  | { action: 'hasUndo' }
  | { action: 'closeDuplicates' }
  | { action: 'hibernateAll' }
  | { action: 'hibernateTab'; tabId: number }
  | { action: 'getStats' }
  | { action: 'findDuplicates' }
  | { action: 'domainStats' }
  | { action: 'previewClassification' }
  | { action: 'isAiReady' }
  | { action: 'learnedCount' }
  | { action: 'clearLearned' }
  | { action: 'snoozeTab'; record: SnoozeRecord }
  | { action: 'getSnoozed' }
  | { action: 'restoreSnoozed'; id: string }
  | { action: 'proxyForHost'; host: string }
  | { action: 'proxyProbe' };
