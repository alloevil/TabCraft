// TabCraft — Basic Tests
import { describe, it, expect } from 'vitest';

// Test normalizeUrl from duplicate.ts
describe('normalizeUrl', () => {
  // Inline implementation for testing (no chrome API dependency)
  function normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      const params = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'msclkid', 'ref', '_ga', '_gl'];
      for (const p of params) u.searchParams.delete(p);
      const pathname = u.pathname.replace(/\/$/, '') || '/';
      let normalized = u.origin + pathname + u.search;
      if (u.hostname.includes('google.') && u.searchParams.has('q')) {
        const q = u.searchParams.get('q');
        normalized = `${u.origin}${pathname}?q=${encodeURIComponent(q!)}`;
      }
      return normalized;
    } catch {
      return url;
    }
  }

  it('removes tracking params', () => {
    const url = 'https://example.com/page?utm_source=twitter&utm_medium=social&id=123';
    expect(normalizeUrl(url)).toBe('https://example.com/page?id=123');
  });

  it('removes trailing slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
    expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path');
  });

  it('normalizes Google search', () => {
    const url = 'https://www.google.com/search?q=test&utm_source=bookmark';
    expect(normalizeUrl(url)).toBe('https://www.google.com/search?q=test');
  });

  it('handles invalid URLs gracefully', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });

  it('detects duplicates after normalization', () => {
    const url1 = 'https://example.com/page?utm_source=twitter';
    const url2 = 'https://example.com/page?ref=newsletter';
    expect(normalizeUrl(url1)).toBe(normalizeUrl(url2));
  });
});

// Test extractDomain from rule-engine.ts
describe('extractDomain', () => {
  function extractDomain(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  it('extracts domain from URL', () => {
    expect(extractDomain('https://www.google.com/search?q=test')).toBe('google.com');
  });

  it('removes www prefix', () => {
    expect(extractDomain('https://www.github.com/user/repo')).toBe('github.com');
  });

  it('handles invalid URLs', () => {
    expect(extractDomain('not-a-url')).toBe('');
  });
});

// Test category parsing
describe('category parsing', () => {
  const CATEGORIES = [
    'Development', 'Social', 'Work', 'Shopping', 'News', 'Entertainment',
    'Finance', 'Education', 'Research', 'Reference', 'Travel', 'Health',
    'AI & ML', 'Gaming', 'Music', 'Video', 'Design', 'Communication',
    'Cloud & DevOps', 'Security', 'Other',
  ] as const;

  type CategoryName = typeof CATEGORIES[number];

  function parseCategory(response: string): CategoryName | null {
    const cleaned = response.trim().replace(/['"]/g, '');
    if ((CATEGORIES as readonly string[]).includes(cleaned)) {
      return cleaned as CategoryName;
    }
    const lower = cleaned.toLowerCase();
    for (const cat of CATEGORIES) {
      if (cat.toLowerCase() === lower || cat.toLowerCase().includes(lower)) {
        return cat as CategoryName;
      }
    }
    return null;
  }

  it('parses exact category match', () => {
    expect(parseCategory('Development')).toBe('Development');
  });

  it('parses category with quotes', () => {
    expect(parseCategory('"Social"')).toBe('Social');
  });

  it('parses case-insensitive', () => {
    expect(parseCategory('DEVELOPMENT')).toBe('Development');
  });

  it('parses partial match', () => {
    expect(parseCategory('dev')).toBe('Development');
  });

  it('returns null for unknown category', () => {
    expect(parseCategory('UnknownCategory')).toBeNull();
  });
});

// Test RuleEngine — pure logic, no chrome API dependency
describe('RuleEngine classification', async () => {
  const { RuleEngine } = await import('../background/ai/rule-engine');
  const engine = new RuleEngine();

  it('classifies expanded domains correctly', () => {
    expect(engine.classify('https://www.zhihu.com/question/1', '知乎').category).toBe('Social');
    expect(engine.classify('https://leetcode.com/problems/two-sum', 'LeetCode').category).toBe('Development');
    expect(engine.classify('https://www.bilibili.com/video/x', 'B站').category).toBe('Entertainment');
    expect(engine.classify('https://booking.com/hotel/x', 'Booking').category).toBe('Travel');
  });

  it('matches subdomains via normalization', () => {
    // mail.qq.com is a seed rule; sub.unknown still falls through
    expect(engine.classify('https://platform.openai.com/docs', 'OpenAI').category).toBe('AI & ML');
  });

  it('does NOT misclassify short keywords as substrings', () => {
    // "ai" must not match "rain"; "code" must not match "barcode"
    const rain = engine.classify('https://unknown-weather-xyz.test/', 'Rain forecast today');
    expect(rain.category).not.toBe('AI & ML');
    const barcode = engine.classify('https://unknown-shop-xyz.test/', 'Barcode scanner');
    expect(barcode.category).not.toBe('Development');
  });

  it('still matches whole-word keywords in titles', () => {
    const ai = engine.classify('https://unknown-xyz.test/', 'New AI model released');
    expect(ai.category).toBe('AI & ML');
  });
});
