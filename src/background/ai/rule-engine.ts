// TabCraft — Rule-based Classification Engine
// Fallback when Gemini Nano is unavailable

import type { ClassificationResult, DomainRule } from '../../shared/types';

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

/** Normalize domain for matching (remove subdomains for common patterns) */
function normalizeDomain(domain: string): string {
  // For sites like mail.google.com -> google.com
  const parts = domain.split('.');
  if (parts.length > 2) {
    // Keep last 2 parts for common TLDs
    const commonTlds = ['com', 'org', 'net', 'io', 'dev', 'app', 'co'];
    const tld = parts[parts.length - 1];
    if (commonTlds.includes(tld) || domain.endsWith('.com.cn')) {
      return parts.slice(-2).join('.');
    }
  }
  return domain;
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

/** Default seed rules — loaded from storage or built-in */
const DEFAULT_RULES: DomainRule[] = [
  // Development
  { id: 'r1', domain: 'github.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r2', domain: 'gitlab.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r3', domain: 'stackoverflow.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r4', domain: 'developer.mozilla.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r5', domain: 'npmjs.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r6', domain: 'vercel.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r7', domain: 'netlify.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r8', domain: 'codepen.io', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r9', domain: 'codesandbox.io', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r10', domain: 'docker.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },

  // AI & ML
  { id: 'r20', domain: 'chat.openai.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r21', domain: 'claude.ai', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r22', domain: 'huggingface.co', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r23', domain: 'arxiv.org', category: 'Research', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r24', domain: 'kaggle.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r25', domain: 'colab.research.google.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Social
  { id: 'r30', domain: 'twitter.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r31', domain: 'x.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r32', domain: 'reddit.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r33', domain: 'linkedin.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r34', domain: 'facebook.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r35', domain: 'instagram.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r36', domain: 'mastodon.social', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Entertainment
  { id: 'r40', domain: 'youtube.com', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r41', domain: 'netflix.com', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r42', domain: 'twitch.tv', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r43', domain: 'spotify.com', category: 'Music', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Work / Productivity
  { id: 'r50', domain: 'notion.so', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r51', domain: 'figma.com', category: 'Design', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r52', domain: 'slack.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r53', domain: 'discord.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r54', domain: 'zoom.us', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r55', domain: 'trello.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r56', domain: 'asana.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r57', domain: 'jira.atlassian.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Google Suite
  { id: 'r60', domain: 'docs.google.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r61', domain: 'sheets.google.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r62', domain: 'drive.google.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r63', domain: 'mail.google.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r64', domain: 'calendar.google.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Shopping
  { id: 'r70', domain: 'amazon.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r71', domain: 'ebay.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r72', domain: 'etsy.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },

  // News
  { id: 'r80', domain: 'news.ycombinator.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r81', domain: 'medium.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r82', domain: 'techcrunch.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r83', domain: 'theverge.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Finance
  { id: 'r90', domain: 'finance.yahoo.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r91', domain: 'bloomberg.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r92', domain: 'coinmarketcap.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Cloud & DevOps
  { id: 'r100', domain: 'aws.amazon.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r101', domain: 'console.cloud.google.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r102', domain: 'portal.azure.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
];

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

  /** Load rules into the engine */
  loadRules(rules: DomainRule[]): void {
    this.rules.clear();
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
        confidence: 0.95,
        source: 'rule',
      };
    }

    // 2. Exact domain match
    const exact = this.rules.get(domain);
    if (exact) {
      return {
        category: exact.category,
        confidence: 0.9,
        source: 'rule',
      };
    }

    // 3. Normalized domain match
    const normalized = normalizeDomain(domain);
    if (normalized !== domain) {
      const normRule = this.rules.get(normalized);
      if (normRule) {
        return {
          category: normRule.category,
          confidence: 0.8,
          source: 'rule',
        };
      }
    }

    // 4. Title-based keyword fallback
    const titleCategory = this.classifyByTitle(title);
    if (titleCategory) {
      return {
        category: titleCategory,
        confidence: 0.6,
        source: 'fallback',
      };
    }

    // 5. Default
    return {
      category: 'Other',
      confidence: 0.3,
      source: 'fallback',
    };
  }

  /** Title keyword analysis */
  private classifyByTitle(title: string): string | null {
    const lower = title.toLowerCase();

    const keywordMap: Record<string, string[]> = {
      'Development': ['api', 'docs', 'documentation', 'sdk', 'npm', 'pip', 'github', 'gitlab', 'code', 'debug', 'terminal', 'console', 'localhost', 'webpack', 'vite', 'docker', 'kubernetes', 'k8s'],
      'AI & ML': ['gpt', 'llm', 'ai', 'machine learning', 'neural', 'model', 'inference', 'training', 'transformer', 'diffusion', 'embedding', 'chatgpt', 'claude', 'gemini'],
      'Social': ['twitter', 'reddit', 'instagram', 'facebook', 'linkedin', 'mastodon', 'social', 'post', 'feed', 'timeline'],
      'Shopping': ['shop', 'cart', 'checkout', 'buy', 'price', 'deal', 'sale', 'amazon', 'ebay', 'etsy'],
      'News': ['news', 'breaking', 'report', 'article', 'headline', 'techcrunch', 'verge', 'arstechnica'],
      'Entertainment': ['video', 'watch', 'stream', 'movie', 'show', 'episode', 'youtube', 'netflix', 'twitch', 'spotify'],
      'Finance': ['stock', 'crypto', 'bitcoin', 'trading', 'market', 'portfolio', 'invest', 'finance', 'wallet'],
      'Work': ['meeting', 'calendar', 'task', 'project', 'sprint', 'jira', 'notion', 'trello', 'asana', 'kanban'],
      'Communication': ['mail', 'email', 'inbox', 'message', 'chat', 'slack', 'discord', 'zoom', 'teams', 'whatsapp'],
      'Design': ['design', 'figma', 'sketch', 'prototype', 'wireframe', 'ui', 'ux', 'adobe', 'canva'],
      'Research': ['paper', 'journal', 'research', 'study', 'arxiv', 'scholar', 'pubmed', 'thesis'],
      'Education': ['course', 'learn', 'tutorial', 'lesson', 'academy', 'udemy', 'coursera', 'mooc'],
    };

    for (const [category, keywords] of Object.entries(keywordMap)) {
      if (keywords.some(kw => lower.includes(kw))) {
        return category;
      }
    }

    return null;
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
