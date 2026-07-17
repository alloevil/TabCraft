// TabCraft — Rule-based Classification Engine
// Fallback when Gemini Nano is unavailable

import type { ClassificationResult, DomainRule } from '../../shared/types';
import seedRulesData from '../../rules/seed-rules.json';
import { RULE_CONFIDENCE } from '../../shared/constants';
import { getDomain } from 'tldts';

/** Extract domain from URL */
export function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    // Remove www. prefix
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Precompiled whole-word matchers, keyed by keyword. Built once at module
 *  load instead of `new RegExp(...)` on every call — scoreText() runs this
 *  for every (category, keyword) pair on every classified tab, so recompiling
 *  regex per-call would mean thousands of redundant compilations per
 *  smartGroupAll() pass. Multi-word phrases don't need a regex at all: they
 *  match as plain substrings. */
const WORD_MATCHERS: Map<string, RegExp> = new Map();

function getWordMatcher(keyword: string): RegExp {
  let re = WORD_MATCHERS.get(keyword);
  if (!re) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    WORD_MATCHERS.set(keyword, re);
  }
  return re;
}

/** Whole-word keyword match — avoids "ai" matching "rain", "code" matching
 *  "barcode", "ui" matching "build", etc. Multi-word phrases match as substrings. */
function matchesWord(haystack: string, keyword: string): boolean {
  if (keyword.includes(' ')) return haystack.includes(keyword);
  return getWordMatcher(keyword).test(haystack);
}

/** Deterministic tie-break order for title scoring. Specific, unambiguous
 *  topics come BEFORE broad/platform-ish ones, so a title that scores equally
 *  for "Music" and "Entertainment" resolves to the more specific "Music".
 *  Categories not listed here (i.e. that never score via keywords) fall back
 *  to lowest priority — see priorityOf(). */
const CATEGORY_PRIORITY: string[] = [
  'Finance', 'Health', 'Security', 'Travel', 'Gaming', 'Music', 'Video', 'Research',
  'Education', 'Reference', 'Design', 'Shopping', 'AI & ML', 'Cloud & DevOps', 'Development', 'Work',
  'Communication', 'News', 'Social', 'Entertainment', 'Other',
];

/** Priority lookup that treats "not in the list" as lowest priority instead
 *  of `indexOf`'s -1, which would otherwise win every tie-break. */
function priorityOf(category: string): number {
  const idx = CATEGORY_PRIORITY.indexOf(category);
  return idx === -1 ? CATEGORY_PRIORITY.length : idx;
}

/** Keyword lists per category, shared by title and URL-path scoring. */
const KEYWORD_MAP: Record<string, string[]> = {
  'Development': ['api', 'docs', 'documentation', 'sdk', 'npm', 'pip', 'github', 'gitlab', 'code', 'debug', 'terminal', 'console', 'localhost', 'webpack', 'vite', 'docker', 'kubernetes', 'k8s', 'compiler', 'runtime', 'framework', 'library', 'repository', 'pull request', 'merge', 'deploy'],
  'AI & ML': ['gpt', 'llm', 'ai', 'machine learning', 'neural', 'model', 'inference', 'training', 'transformer', 'diffusion', 'embedding', 'chatgpt', 'claude', 'gemini', 'deep learning', 'fine-tuning', 'prompt', 'dataset', 'hugging face'],
  'Social': ['twitter', 'reddit', 'instagram', 'facebook', 'linkedin', 'mastodon', 'social', 'post', 'feed', 'timeline', 'follower', 'tweet', 'profile', 'tiktok', 'weibo', 'threads'],
  'Shopping': ['shop', 'cart', 'checkout', 'buy', 'price', 'deal', 'sale', 'amazon', 'ebay', 'etsy', 'order', 'shipping', 'discount', 'coupon', 'store', 'product', 'add to cart', 'wishlist', 'taobao', 'aliexpress'],
  'News': ['news', 'breaking', 'report', 'article', 'headline', 'techcrunch', 'verge', 'arstechnica', 'reuters', 'bbc', 'cnn', 'press', 'editorial', 'coverage', 'bloomberg'],
  'Entertainment': ['video', 'watch', 'stream', 'movie', 'show', 'episode', 'youtube', 'netflix', 'twitch', 'trailer', 'season', 'binge', 'cinema', 'film'],
  'Music': ['music', 'song', 'album', 'playlist', 'spotify', 'soundcloud', 'lyrics', 'track', 'artist', 'concert', 'audio', 'podcast'],
  'Video': ['youtube', 'vimeo', 'video', 'clip', 'livestream', 'webinar', 'recording'],
  'Finance': ['stock', 'crypto', 'bitcoin', 'trading', 'market', 'portfolio', 'invest', 'finance', 'wallet', 'bank', 'budget', 'tax', 'mortgage', 'loan', 'ethereum', 'nasdaq', 'dividend', 'forex'],
  'Work': ['meeting', 'calendar', 'task', 'project', 'sprint', 'jira', 'notion', 'trello', 'asana', 'kanban', 'standup', 'roadmap', 'okr', 'deadline', 'ticket'],
  'Communication': ['mail', 'email', 'inbox', 'message', 'chat', 'slack', 'discord', 'zoom', 'teams', 'whatsapp', 'telegram', 'gmail', 'outlook', 'compose'],
  'Design': ['design', 'figma', 'sketch', 'prototype', 'wireframe', 'ui', 'ux', 'adobe', 'canva', 'typography', 'palette', 'mockup', 'illustrator', 'photoshop'],
  'Research': ['paper', 'journal', 'research', 'study', 'arxiv', 'scholar', 'pubmed', 'thesis', 'citation', 'preprint', 'abstract', 'doi'],
  'Education': ['course', 'learn', 'tutorial', 'lesson', 'academy', 'udemy', 'coursera', 'mooc', 'lecture', 'quiz', 'homework', 'exam', 'syllabus', 'khan academy'],
  'Health': ['health', 'fitness', 'workout', 'diet', 'nutrition', 'symptom', 'doctor', 'medical', 'clinic', 'wellness', 'calories', 'webmd', 'exercise', 'meditation'],
  'Travel': ['flight', 'hotel', 'booking', 'trip', 'travel', 'airbnb', 'itinerary', 'destination', 'expedia', 'vacation', 'airline', 'reservation', 'tripadvisor'],
  'Gaming': ['game', 'gaming', 'steam', 'playstation', 'xbox', 'nintendo', 'twitch', 'esports', 'gameplay', 'speedrun', 'fps', 'rpg', 'minecraft'],
  'Cloud & DevOps': ['cloud', 'devops', 'deployment', 'infrastructure', 'kubernetes', 'k8s', 'docker', 'terraform', 'ansible', 'ci/cd', 'pipeline', 'server', 'hosting', 'serverless', 'monitoring', 'observability', 'logging', 'aws', 'azure', 'gcp'],
  'Security': ['security', 'vulnerability', 'exploit', 'cve', 'malware', 'phishing', 'firewall', 'encryption', 'pentest', 'breach', 'password manager', '2fa', 'authenticator', 'antivirus', 'ransomware'],
  'Reference': ['dictionary', 'definition', 'thesaurus', 'translate', 'translation', 'wiki', 'encyclopedia', 'how to', 'reference', 'synonym', 'wikihow'],
};

/** Tokenize a URL's path + query into space-separated words for keyword
 *  scoring. Splits on /._-?=& and the like, drops pure-numeric segments
 *  (IDs, timestamps) and very short tokens that carry no topical signal. */
export function tokenizeUrlPath(url: string): string {
  let path = '';
  try {
    const u = new URL(url);
    path = `${u.pathname} ${u.search}`;
  } catch {
    return '';
  }
  return path
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok.length >= 3 && !/^\d+$/.test(tok))
    .join(' ');
}

/** Collapse a hostname to its registrable domain (eTLD+1) for the
 *  normalized-domain fallback tier, e.g. mail.google.com -> google.com,
 *  www.bbc.co.uk -> bbc.co.uk. Uses the Public Suffix List (via tldts)
 *  instead of a hand-rolled TLD guess list, so multi-part suffixes like
 *  .co.uk/.com.cn/.ac.jp are handled correctly instead of silently falling
 *  through unnormalized. */
function normalizeDomain(domain: string): string {
  return getDomain(domain) ?? domain;
}

/** Friendly names for well-known domains */
const DOMAIN_FRIENDLY_NAMES: Record<string, string> = {
  'github.com': 'GitHub',
  'gitlab.com': 'GitLab',
  'stackoverflow.com': 'Stack Overflow',
  'developer.mozilla.org': 'MDN',
  'youtube.com': 'YouTube',
  'twitter.com': 'Twitter',
  'x.com': 'X (Twitter)',
  'reddit.com': 'Reddit',
  'linkedin.com': 'LinkedIn',
  'facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'notion.so': 'Notion',
  'figma.com': 'Figma',
  'slack.com': 'Slack',
  'discord.com': 'Discord',
  'zoom.us': 'Zoom',
  'docs.google.com': 'Google Docs',
  'sheets.google.com': 'Google Sheets',
  'drive.google.com': 'Google Drive',
  'translate.google.com': 'Translate',
  'mail.google.com': 'Gmail',
  'calendar.google.com': 'Calendar',
  'amazon.com': 'Amazon',
  'netflix.com': 'Netflix',
  'spotify.com': 'Spotify',
  'medium.com': 'Medium',
  'chat.openai.com': 'ChatGPT',
  'claude.ai': 'Claude',
  'huggingface.co': 'Hugging Face',
  'arxiv.org': 'arXiv',
};

/** Get friendly name for a domain */
export function getFriendlyName(domain: string): string | null {
  return DOMAIN_FRIENDLY_NAMES[domain] ?? null;
}

/** Seed domain->category rules, bundled as data (see src/rules/seed-rules.json)
 *  so the classification *logic* in this file isn't buried under a wall of
 *  ~390 static literals. IDs are derived deterministically from the domain
 *  so they stay stable across regenerations of the JSON file. */
const DEFAULT_RULES: DomainRule[] = (seedRulesData as { domain: string; category: string; multiPurpose?: boolean }[]).map(
  (r) => ({
    id: `seed_${r.domain}`,
    domain: r.domain,
    category: r.category,
    source: 'seed',
    createdAt: 0,
    updatedAt: 0,
    multiPurpose: r.multiPurpose,
  })
);

/**
 * Rule-based classification engine
 * Uses domain matching + title keyword analysis as fallback
 */
export class RuleEngine {
  private rules: Map<string, DomainRule> = new Map();
  private learnedMappings: Record<string, string> = {};

  constructor(rules?: DomainRule[], learned?: Record<string, string>) {
    this.loadRules(rules ?? DEFAULT_RULES);
    if (learned) {
      this.learnedMappings = learned;
    }
  }

  /** Load rules into the engine, replacing whatever was loaded before. */
  loadRules(rules: DomainRule[]): void {
    this.rules.clear();
    for (const rule of rules) {
      this.rules.set(rule.domain, rule);
    }
  }

  /** Merge rules on top of whatever is already loaded (no clear). Used to
   *  layer user-added custom rules over the seed set without wiping it —
   *  loadRules() would otherwise discard all ~390 seed rules the moment a
   *  user adds a single custom one, since Storage.getRules() only persists
   *  custom rules, not seed ones. */
  addRules(rules: DomainRule[]): void {
    for (const rule of rules) {
      this.rules.set(rule.domain, rule);
    }
  }

  /** Update learned mappings */
  setLearnedMappings(mappings: Record<string, string>): void {
    this.learnedMappings = mappings;
  }

  /** Classify a tab by URL and title */
  classify(url: string, title: string): ClassificationResult {
    const domain = extractDomain(url);

    // 1. Check learned mappings (highest priority)
    if (this.learnedMappings[domain]) {
      return {
        category: this.learnedMappings[domain],
        confidence: RULE_CONFIDENCE.LEARNED,
        source: 'rule',
      };
    }

    // 2. Exact domain match
    const exact = this.rules.get(domain);
    if (exact) {
      return this.resolveDomainMatch(exact, title, RULE_CONFIDENCE.EXACT_DOMAIN);
    }

    // 3. Normalized domain match
    const normalized = normalizeDomain(domain);
    if (normalized !== domain) {
      const normRule = this.rules.get(normalized);
      if (normRule) {
        return this.resolveDomainMatch(normRule, title, RULE_CONFIDENCE.NORMALIZED_DOMAIN);
      }
    }

    // 4. URL path keywords — structured, site-defined signal. More reliable
    //    than free-text title, so it ranks above title but below domain rules.
    const pathTokens = tokenizeUrlPath(url);
    if (pathTokens) {
      const pathCategory = this.scoreText(pathTokens);
      if (pathCategory) {
        return {
          category: pathCategory,
          confidence: RULE_CONFIDENCE.URL_PATH_KEYWORDS,
          source: 'rule',
        };
      }
    }

    // 5. Title-based keyword fallback
    const titleCategory = this.classifyByTitle(title);
    if (titleCategory) {
      return {
        category: titleCategory,
        confidence: RULE_CONFIDENCE.TITLE_KEYWORDS,
        source: 'fallback',
      };
    }

    // 6. Default
    return {
      category: 'Other',
      confidence: RULE_CONFIDENCE.DEFAULT_OTHER,
      source: 'fallback',
    };
  }

  /** Resolve a matched domain rule, honoring `multiPurpose`.
   *
   *  Ordinary domain rules return immediately at their tier confidence.
   *  Multi-purpose domains (social feeds, UGC video, Q&A/blogging
   *  aggregators — per-page topic varies far more than the domain implies)
   *  instead try the tab's own TITLE keywords first; the domain's category
   *  is only a last-resort default, tagged 'fallback' so the AI classifier
   *  (if available) still gets a chance to weigh in instead of the domain
   *  silently winning.
   *
   *  URL path tokens are deliberately NOT consulted here: on platforms like
   *  bilibili/youtube every URL contains structural boilerplate ("video",
   *  "watch") that would otherwise masquerade as real content signal and
   *  just re-derive the domain's own category from the URL shape. */
  private resolveDomainMatch(rule: DomainRule, title: string, confidence: number): ClassificationResult {
    if (!rule.multiPurpose) {
      return { category: rule.category, confidence, source: 'rule' };
    }
    const titleCategory = this.classifyByTitle(title);
    if (titleCategory) {
      return { category: titleCategory, confidence: RULE_CONFIDENCE.TITLE_KEYWORDS, source: 'fallback' };
    }
    return { category: rule.category, confidence: RULE_CONFIDENCE.TITLE_KEYWORDS, source: 'fallback' };
  }

  /** Title keyword analysis — delegates to the shared weighted scorer. */
  private classifyByTitle(title: string): string | null {
    return this.scoreText(title.toLowerCase());
  }

  /** Weighted keyword scorer shared by title and URL-path classification.
   *
   *  Scores every category by matched-keyword weight (multi-word phrases weigh
   *  2, single tokens 1) and returns the strongest. Ties break by
   *  CATEGORY_PRIORITY so the outcome is deterministic and testable. `text`
   *  must already be lowercased. */
  private scoreText(text: string): string | null {
    let best: { category: string; score: number } | null = null;
    for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
      let score = 0;
      for (const kw of keywords) {
        if (matchesWord(text, kw)) {
          // Multi-word phrases are far less ambiguous → weight 2; single token → 1.
          score += kw.includes(' ') ? 2 : 1;
        }
      }
      if (score === 0) continue;
      if (
        !best ||
        score > best.score ||
        (score === best.score && priorityOf(category) < priorityOf(best.category))
      ) {
        best = { category, score };
      }
    }
    return best ? best.category : null;
  }

  /** Get all loaded rules */
  getAllRules(): DomainRule[] {
    return Array.from(this.rules.values());
  }

  /** Add a custom rule */
  addRule(domain: string, category: string): DomainRule {
    const rule: DomainRule = {
      id: `user_${Date.now()}`,
      domain,
      category,
      source: 'user',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.rules.set(domain, rule);
    return rule;
  }

  /** Remove a rule */
  removeRule(domain: string): boolean {
    return this.rules.delete(domain);
  }
}
