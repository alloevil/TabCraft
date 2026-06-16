// TabCraft — Shared Types

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
  lastAccessed: number;       // timestamp
  createdAt: number;          // timestamp
  discarded: boolean;         // hibernated?
  status: string;
}

/** A group of tabs */
export interface TabGroup {
  id: string;                 // uuid
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
}

/** User preferences */
export interface Settings {
  autoGroup: boolean;
  minTabsPerGroup: number;
  autoCloseDuplicates: boolean;
  showDuplicateBadge: boolean;
  groupingMode: 'smart' | 'domain';
  hibernationTimeout: number;     // minutes
  theme: 'system' | 'light' | 'dark';
  aiProvider: 'gemini-nano' | 'rule-engine';
  learnFromActivity: boolean;
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
  wakeAt: number;             // timestamp
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
  learnedMappings: Record<string, string>;  // domain -> category
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

export type CategoryName = typeof CATEGORIES[number];

/** Group color palette */
export const GROUP_COLORS: chrome.tabGroups.ColorEnum[] = [
  'blue', 'red', 'yellow', 'green', 'pink',
  'purple', 'cyan', 'orange', 'grey',
];
