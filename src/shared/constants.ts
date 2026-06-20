// TabCraft — Constants

/** Extension name */
export const EXT_NAME = 'TabCraft';

/** Storage keys */
export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  RULES: 'rules',
  WORKSPACES: 'workspaces',
  SNOOZED: 'snoozed',
  LEARNED: 'learnedMappings',
  SESSION: 'sessionSnapshot',
  STATS: 'stats',
} as const;

/** Default settings */
export const DEFAULT_SETTINGS = {
  autoGroup: true,
  minTabsPerGroup: 2,
  autoCloseDuplicates: false,
  showDuplicateBadge: true,
  groupingMode: 'smart' as const,
  hibernationTimeout: 30,       // 30 minutes
  theme: 'system' as const,
  aiProvider: 'gemini-nano' as const,
  learnFromActivity: false,
};

/** Hibernation timeout presets (minutes) */
export const HIBERNATION_PRESETS = [15, 30, 60, 120];

/** Min tabs per group presets */
export const MIN_TABS_PRESETS = [2, 3, 4, 5];

/** Duplicate URL tracking params to strip */
export const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'dclid', 'twclid',
  'mc_cid', 'mc_eid',
  'ref', 'referrer',
  '_ga', '_gl', 'yclid',
  'si', 'feature', 'app',
];

/** Auto-save interval for session (ms) */
export const SESSION_SAVE_INTERVAL = 5 * 60 * 1000; // 5 minutes

/** Max undo history */
export const MAX_UNDO_HISTORY = 10;

/** Max learned domain→category mappings to retain (LRU-evicted) */
export const MAX_LEARNED_MAPPINGS = 500;

/** Snooze presets */
export const SNOOZE_PRESETS = [
  { label: 'In 1 hour', ms: 60 * 60 * 1000 },
  { label: 'In 3 hours', ms: 3 * 60 * 60 * 1000 },
  { label: 'Tomorrow', ms: 24 * 60 * 60 * 1000 },
  { label: 'Next Monday', ms: 7 * 24 * 60 * 60 * 1000 },
];
