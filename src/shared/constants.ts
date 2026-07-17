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
  language: 'en' as const,
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

/** Delay before classifying/auto-grouping a newly created tab, so it has a
 *  chance to load past a blank/placeholder title (ms). */
export const TAB_LOAD_DELAY_MS = 500;

/** Debounce for learning a domain→group mapping from a manual drag (ms). */
export const LEARN_DEBOUNCE_MS = 600;

/** Debounce for the auto-close-duplicates scan triggered by tabs.onUpdated
 *  (ms). Coalesces a burst of URL changes (SPA navigation, session restore)
 *  into a single full-tab-list scan. */
export const DUPLICATE_SCAN_DEBOUNCE_MS = 800;

/** Debounce for the tab-mutation-triggered session snapshot save (ms).
 *  Separate from SESSION_SAVE_INTERVAL, which drives the periodic alarm. */
export const SESSION_SAVE_DEBOUNCE_MS = 1500;

/** Debounce for flushing the hibernation last-access cache to storage (ms).
 *  Tab-activity events update the in-memory cache immediately but batch the
 *  actual chrome.storage.local write, since a full read-modify-write on
 *  every activation/navigation would otherwise fire on nearly every tab
 *  event during normal browsing. */
export const LAST_ACCESS_FLUSH_DEBOUNCE_MS = 3000;

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

/** Confidence values RuleEngine.classify() assigns per match tier, from most
 *  to least trustworthy. Centralized so the tiers stay ordered relative to
 *  each other on purpose (each new tier added later should slot into this
 *  scale rather than picking an arbitrary nearby float). */
export const RULE_CONFIDENCE = {
  LEARNED: 0.95,           // user's own manual-grouping feedback
  EXACT_DOMAIN: 0.9,        // exact domain→category rule
  NORMALIZED_DOMAIN: 0.8,   // rule matched after stripping subdomain
  URL_PATH_KEYWORDS: 0.7,   // keyword match against the URL path/query
  TITLE_KEYWORDS: 0.6,      // keyword match against the tab title (least reliable signal)
  DEFAULT_OTHER: 0.3,       // no rule/keyword matched at all
} as const;

/** Confidence values the Gemini Nano classifier assigns. */
export const AI_CONFIDENCE = {
  SUCCESS: 0.85,  // model returned one of the known category labels
  LOW: 0.4,       // model response couldn't be parsed into a known category
} as const;

/** Minimum AI confidence tab-manager.ts requires before trusting an AI
 *  classification over falling back to the rule engine. */
export const AI_TRUST_THRESHOLD = 0.7;
