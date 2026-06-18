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

/** Whole-word keyword match — avoids "ai" matching "rain", "code" matching
 *  "barcode", "ui" matching "build", etc. Multi-word phrases match as substrings. */
function matchesWord(haystack: string, keyword: string): boolean {
  if (keyword.includes(' ')) return haystack.includes(keyword);
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack);
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
  // Development (extended)
  { id: 'r200', domain: 'bitbucket.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r201', domain: 'npmjs.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r202', domain: 'pypi.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r203', domain: 'rubygems.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r204', domain: 'packagist.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r205', domain: 'crates.io', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r206', domain: 'readthedocs.io', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r207', domain: 'devdocs.io', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r208', domain: 'caniuse.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r209', domain: 'jsfiddle.net', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r210', domain: 'replit.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r211', domain: 'glitch.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r212', domain: 'stackblitz.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r213', domain: 'regex101.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r214', domain: 'postman.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r215', domain: 'insomnia.rest', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r216', domain: 'swagger.io', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r217', domain: 'jsonplaceholder.typicode.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r218', domain: 'leetcode.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r219', domain: 'hackerrank.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r220', domain: 'codewars.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r221', domain: 'exercism.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r222', domain: 'geeksforgeeks.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r223', domain: 'w3schools.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r224', domain: 'tutorialspoint.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r225', domain: 'freecodecamp.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r226', domain: 'dev.to', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r227', domain: 'hashnode.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r228', domain: 'css-tricks.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r229', domain: 'smashingmagazine.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r230', domain: 'raw.githubusercontent.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r231', domain: 'gist.github.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r232', domain: 'sourceforge.net', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r233', domain: 'apache.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r234', domain: 'kernel.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r235', domain: 'rust-lang.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r236', domain: 'go.dev', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r237', domain: 'python.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r238', domain: 'nodejs.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r239', domain: 'reactjs.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r240', domain: 'react.dev', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r241', domain: 'vuejs.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r242', domain: 'angular.io', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r243', domain: 'svelte.dev', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r244', domain: 'tailwindcss.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r245', domain: 'getbootstrap.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r246', domain: 'webpack.js.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r247', domain: 'vitejs.dev', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r248', domain: 'eslint.org', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r249', domain: 'prettier.io', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r250', domain: 'juejin.cn', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r251', domain: 'csdn.net', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r252', domain: 'cnblogs.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r253', domain: 'segmentfault.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r254', domain: 'oschina.net', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r255', domain: 'gitee.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r256', domain: 'v2ex.com', category: 'Development', source: 'seed', createdAt: 0, updatedAt: 0 },

  // AI & ML (extended)
  { id: 'r257', domain: 'openai.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r258', domain: 'platform.openai.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r259', domain: 'anthropic.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r260', domain: 'console.anthropic.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r261', domain: 'gemini.google.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r262', domain: 'bard.google.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r263', domain: 'perplexity.ai', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r264', domain: 'poe.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r265', domain: 'midjourney.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r266', domain: 'stability.ai', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r267', domain: 'replicate.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r268', domain: 'runwayml.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r269', domain: 'civitai.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r270', domain: 'pytorch.org', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r271', domain: 'tensorflow.org', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r272', domain: 'wandb.ai', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r273', domain: 'paperswithcode.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r274', domain: 'ollama.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r275', domain: 'langchain.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r276', domain: 'pinecone.io', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r277', domain: 'cohere.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r278', domain: 'mistral.ai', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r279', domain: 'together.ai', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r280', domain: 'groq.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r281', domain: 'modelscope.cn', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r282', domain: 'deepseek.com', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r283', domain: 'moonshot.cn', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r284', domain: 'zhipuai.cn', category: 'AI & ML', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Social (extended)
  { id: 'r285', domain: 'threads.net', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r286', domain: 'bsky.app', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r287', domain: 'tiktok.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r288', domain: 'pinterest.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r289', domain: 'tumblr.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r290', domain: 'quora.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r291', domain: 'snapchat.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r292', domain: 'weibo.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r293', domain: 'zhihu.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r294', domain: 'douban.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r295', domain: 'tieba.baidu.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r296', domain: 'xiaohongshu.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r297', domain: 'okjike.com', category: 'Social', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Entertainment (extended)
  { id: 'r298', domain: 'primevideo.com', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r299', domain: 'hulu.com', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r300', domain: 'disneyplus.com', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r301', domain: 'hbomax.com', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r302', domain: 'max.com', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r303', domain: 'vimeo.com', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r304', domain: 'dailymotion.com', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r305', domain: 'iqiyi.com', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r306', domain: 'youku.com', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r307', domain: 'v.qq.com', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r308', domain: 'bilibili.com', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r309', domain: 'douyu.com', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r310', domain: 'huya.com', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r311', domain: 'mgtv.com', category: 'Entertainment', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Music (extended)
  { id: 'r312', domain: 'music.apple.com', category: 'Music', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r313', domain: 'soundcloud.com', category: 'Music', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r314', domain: 'tidal.com', category: 'Music', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r315', domain: 'bandcamp.com', category: 'Music', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r316', domain: 'pandora.com', category: 'Music', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r317', domain: 'music.youtube.com', category: 'Music', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r318', domain: 'music.163.com', category: 'Music', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r319', domain: 'y.qq.com', category: 'Music', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r320', domain: 'kugou.com', category: 'Music', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r321', domain: 'kuwo.cn', category: 'Music', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Video (extended)
  { id: 'r322', domain: 'music.amazon.com', category: 'Video', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Work (extended)
  { id: 'r323', domain: 'atlassian.net', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r324', domain: 'confluence.atlassian.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r325', domain: 'monday.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r326', domain: 'clickup.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r327', domain: 'airtable.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r328', domain: 'basecamp.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r329', domain: 'linear.app', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r330', domain: 'height.app', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r331', domain: 'coda.io', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r332', domain: 'miro.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r333', domain: 'mural.co', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r334', domain: 'lucidchart.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r335', domain: 'smartsheet.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r336', domain: 'tower.im', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r337', domain: 'teambition.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r338', domain: 'feishu.cn', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r339', domain: 'larksuite.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r340', domain: 'yuque.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r341', domain: 'worktile.com', category: 'Work', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Communication (extended)
  { id: 'r342', domain: 'outlook.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r343', domain: 'outlook.office.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r344', domain: 'outlook.live.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r345', domain: 'proton.me', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r346', domain: 'protonmail.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r347', domain: 'tutanota.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r348', domain: 'messenger.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r349', domain: 'telegram.org', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r350', domain: 'web.telegram.org', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r351', domain: 'web.whatsapp.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r352', domain: 'teams.microsoft.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r353', domain: 'meet.google.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r354', domain: 'webex.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r355', domain: 'mail.qq.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r356', domain: 'mail.163.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r357', domain: 'wx.qq.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r358', domain: 'dingtalk.com', category: 'Communication', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Shopping (extended)
  { id: 'r359', domain: 'walmart.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r360', domain: 'target.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r361', domain: 'bestbuy.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r362', domain: 'aliexpress.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r363', domain: 'alibaba.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r364', domain: 'wish.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r365', domain: 'newegg.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r366', domain: 'costco.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r367', domain: 'ikea.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r368', domain: 'taobao.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r369', domain: 'tmall.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r370', domain: 'jd.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r371', domain: 'pinduoduo.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r372', domain: 'suning.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r373', domain: 'vip.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r374', domain: 'dangdang.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r375', domain: 'mercadolibre.com', category: 'Shopping', source: 'seed', createdAt: 0, updatedAt: 0 },

  // News (extended)
  { id: 'r376', domain: 'bbc.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r377', domain: 'cnn.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r378', domain: 'nytimes.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r379', domain: 'theguardian.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r380', domain: 'reuters.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r381', domain: 'apnews.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r382', domain: 'wsj.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r383', domain: 'washingtonpost.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r384', domain: 'economist.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r385', domain: 'forbes.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r386', domain: 'wired.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r387', domain: 'engadget.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r388', domain: 'arstechnica.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r389', domain: 'lite.cnn.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r390', domain: '36kr.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r391', domain: 'huxiu.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r392', domain: 'ifanr.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r393', domain: 'sspai.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r394', domain: 'thepaper.cn', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r395', domain: 'sina.com.cn', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r396', domain: '163.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r397', domain: 'sohu.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r398', domain: 'qq.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r399', domain: 'ithome.com', category: 'News', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Finance (extended)
  { id: 'r400', domain: 'coinbase.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r401', domain: 'binance.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r402', domain: 'kraken.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r403', domain: 'robinhood.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r404', domain: 'fidelity.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r405', domain: 'schwab.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r406', domain: 'tradingview.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r407', domain: 'investing.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r408', domain: 'marketwatch.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r409', domain: 'morningstar.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r410', domain: 'paypal.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r411', domain: 'stripe.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r412', domain: 'wise.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r413', domain: 'mint.intuit.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r414', domain: 'xueqiu.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r415', domain: 'eastmoney.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r416', domain: '10jqka.com.cn', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r417', domain: 'alipay.com', category: 'Finance', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Education (extended)
  { id: 'r418', domain: 'khanacademy.org', category: 'Education', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r419', domain: 'edx.org', category: 'Education', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r420', domain: 'udacity.com', category: 'Education', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r421', domain: 'skillshare.com', category: 'Education', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r422', domain: 'pluralsight.com', category: 'Education', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r423', domain: 'brilliant.org', category: 'Education', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r424', domain: 'duolingo.com', category: 'Education', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r425', domain: 'quizlet.com', category: 'Education', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r426', domain: 'chegg.com', category: 'Education', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r427', domain: 'wikipedia.org', category: 'Education', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r428', domain: 'wikibooks.org', category: 'Education', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r429', domain: 'ted.com', category: 'Education', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r430', domain: 'icourse163.org', category: 'Education', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r431', domain: 'xuetangx.com', category: 'Education', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r432', domain: 'imooc.com', category: 'Education', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Research (extended)
  { id: 'r433', domain: 'scholar.google.com', category: 'Research', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r434', domain: 'researchgate.net', category: 'Research', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r435', domain: 'semanticscholar.org', category: 'Research', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r436', domain: 'jstor.org', category: 'Research', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r437', domain: 'sciencedirect.com', category: 'Research', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r438', domain: 'springer.com', category: 'Research', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r439', domain: 'nature.com', category: 'Research', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r440', domain: 'ncbi.nlm.nih.gov', category: 'Research', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r441', domain: 'biorxiv.org', category: 'Research', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r442', domain: 'ssrn.com', category: 'Research', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r443', domain: 'cnki.net', category: 'Research', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r444', domain: 'wanfangdata.com.cn', category: 'Research', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Design (extended)
  { id: 'r445', domain: 'dribbble.com', category: 'Design', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r446', domain: 'behance.net', category: 'Design', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r447', domain: 'awwwards.com', category: 'Design', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r448', domain: 'unsplash.com', category: 'Design', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r449', domain: 'pexels.com', category: 'Design', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r450', domain: 'fonts.google.com', category: 'Design', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r451', domain: 'fontawesome.com', category: 'Design', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r452', domain: 'coolors.co', category: 'Design', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r453', domain: 'framer.com', category: 'Design', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r454', domain: 'webflow.com', category: 'Design', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r455', domain: 'penpot.app', category: 'Design', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r456', domain: 'zcool.com.cn', category: 'Design', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r457', domain: 'ui.cn', category: 'Design', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Cloud & DevOps (extended)
  { id: 'r458', domain: 'cloudflare.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r459', domain: 'dash.cloudflare.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r460', domain: 'digitalocean.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r461', domain: 'heroku.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r462', domain: 'render.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r463', domain: 'railway.app', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r464', domain: 'fly.io', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r465', domain: 'supabase.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r466', domain: 'firebase.google.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r467', domain: 'planetscale.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r468', domain: 'mongodb.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r469', domain: 'redis.io', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r470', domain: 'grafana.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r471', domain: 'datadoghq.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r472', domain: 'sentry.io', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r473', domain: 'circleci.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r474', domain: 'travis-ci.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r475', domain: 'jenkins.io', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r476', domain: 'console.aliyun.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r477', domain: 'cloud.tencent.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r478', domain: 'huaweicloud.com', category: 'Cloud & DevOps', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Security (extended)
  { id: 'r479', domain: 'haveibeenpwned.com', category: 'Security', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r480', domain: 'virustotal.com', category: 'Security', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r481', domain: 'shodan.io', category: 'Security', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r482', domain: 'owasp.org', category: 'Security', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r483', domain: 'cve.mitre.org', category: 'Security', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r484', domain: 'nvd.nist.gov', category: 'Security', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r485', domain: '1password.com', category: 'Security', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r486', domain: 'bitwarden.com', category: 'Security', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r487', domain: 'lastpass.com', category: 'Security', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r488', domain: 'authy.com', category: 'Security', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Gaming (extended)
  { id: 'r489', domain: 'store.steampowered.com', category: 'Gaming', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r490', domain: 'steamcommunity.com', category: 'Gaming', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r491', domain: 'epicgames.com', category: 'Gaming', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r492', domain: 'gog.com', category: 'Gaming', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r493', domain: 'itch.io', category: 'Gaming', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r494', domain: 'ign.com', category: 'Gaming', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r495', domain: 'gamespot.com', category: 'Gaming', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r496', domain: 'roblox.com', category: 'Gaming', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r497', domain: 'minecraft.net', category: 'Gaming', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r498', domain: 'ea.com', category: 'Gaming', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r499', domain: 'ubisoft.com', category: 'Gaming', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r500', domain: 'playstation.com', category: 'Gaming', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r501', domain: 'xbox.com', category: 'Gaming', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r502', domain: 'nintendo.com', category: 'Gaming', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r503', domain: '4399.com', category: 'Gaming', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r504', domain: 'yys.163.com', category: 'Gaming', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Travel (extended)
  { id: 'r505', domain: 'booking.com', category: 'Travel', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r506', domain: 'airbnb.com', category: 'Travel', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r507', domain: 'expedia.com', category: 'Travel', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r508', domain: 'tripadvisor.com', category: 'Travel', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r509', domain: 'kayak.com', category: 'Travel', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r510', domain: 'skyscanner.com', category: 'Travel', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r511', domain: 'agoda.com', category: 'Travel', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r512', domain: 'hotels.com', category: 'Travel', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r513', domain: 'trip.com', category: 'Travel', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r514', domain: 'ctrip.com', category: 'Travel', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r515', domain: 'qunar.com', category: 'Travel', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r516', domain: 'fliggy.com', category: 'Travel', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r517', domain: '12306.cn', category: 'Travel', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Health (extended)
  { id: 'r519', domain: 'webmd.com', category: 'Health', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r520', domain: 'mayoclinic.org', category: 'Health', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r521', domain: 'healthline.com', category: 'Health', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r522', domain: 'nih.gov', category: 'Health', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r523', domain: 'who.int', category: 'Health', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r524', domain: 'myfitnesspal.com', category: 'Health', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r525', domain: 'strava.com', category: 'Health', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r526', domain: 'fitbit.com', category: 'Health', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r527', domain: 'dxy.cn', category: 'Health', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r528', domain: 'haodf.com', category: 'Health', source: 'seed', createdAt: 0, updatedAt: 0 },

  // Reference (extended)
  { id: 'r529', domain: 'dictionary.com', category: 'Reference', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r530', domain: 'merriam-webster.com', category: 'Reference', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r531', domain: 'thesaurus.com', category: 'Reference', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r532', domain: 'wolframalpha.com', category: 'Reference', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r533', domain: 'translate.google.com', category: 'Reference', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r534', domain: 'deepl.com', category: 'Reference', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r535', domain: 'fanyi.baidu.com', category: 'Reference', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r536', domain: 'wikihow.com', category: 'Reference', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r537', domain: 'imdb.com', category: 'Reference', source: 'seed', createdAt: 0, updatedAt: 0 },
  { id: 'r538', domain: 'goodreads.com', category: 'Reference', source: 'seed', createdAt: 0, updatedAt: 0 },
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
      if (keywords.some(kw => matchesWord(lower, kw))) {
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
