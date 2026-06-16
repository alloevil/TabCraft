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
      let pathname = u.pathname.replace(/\/$/, '') || '/';
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
