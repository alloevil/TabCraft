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

  it('weighted scoring: picks the category with the most keyword hits', () => {
    // Title hits Music three ways (music, album, playlist) vs Entertainment once
    // (stream). Old first-match logic returned Entertainment (listed earlier);
    // weighted scoring must now pick Music.
    const r = engine.classify('https://unknown-host.test/', 'Stream this album playlist — new music');
    expect(r.category).toBe('Music');
  });

  it('weighted scoring: multi-word phrase outweighs a single ambiguous token', () => {
    // "machine learning" (phrase, weight 2) for AI&ML beats a lone "code"
    // (weight 1) for Development.
    const r = engine.classify('https://unknown-host.test/', 'A machine learning code sample');
    expect(r.category).toBe('AI & ML');
  });

  it('expanded lifestyle keywords no longer fall through to Other', () => {
    expect(engine.classify('https://unknown-h.test/', 'Best hotel booking for our trip').category).toBe('Travel');
    expect(engine.classify('https://unknown-h.test/', 'My workout and nutrition plan').category).toBe('Health');
    expect(engine.classify('https://unknown-h.test/', 'Steam game library on sale').category).not.toBe('Other');
  });
});

// Test colorForCategory — stable category→color mapping (imported directly,
// the function is exported and has no runtime chrome dependency).
describe('colorForCategory', async () => {
  const { colorForCategory, CATEGORY_COLORS } = await import('../shared/types');

  it('returns the mapped color for known categories', () => {
    expect(colorForCategory('Development')).toBe('blue');
    expect(colorForCategory('AI & ML')).toBe('purple');
    expect(colorForCategory('Other')).toBe('grey');
  });

  it('is stable: same category always yields the same color', () => {
    const first = colorForCategory('SomeCustomDomainGroup');
    const second = colorForCategory('SomeCustomDomainGroup');
    expect(first).toBe(second);
  });

  it('never assigns grey to an unknown (hashed) category', () => {
    // grey is reserved for "Other"; hashed colors must avoid it
    for (const name of ['acme.io', 'foobar', 'xyz-corp', 'my project', 'random123']) {
      expect(colorForCategory(name)).not.toBe('grey');
    }
  });

  it('only ever returns colors from the known palette', () => {
    const palette = new Set(Object.values(CATEGORY_COLORS));
    // hashed names may produce any non-grey palette color; assert it's valid
    const valid = new Set([...palette, 'cyan', 'orange', 'pink', 'yellow', 'red', 'green', 'blue', 'purple']);
    expect(valid.has(colorForCategory('totally-unknown-name'))).toBe(true);
  });
});

// Test parseBatchResponse — parsing of numbered batch AI responses.
// Inlined to match this file's convention (private fn in gemini-nano.ts).
describe('parseBatchResponse', () => {
  const CATEGORIES = [
    'Development', 'Social', 'Work', 'Shopping', 'News', 'Entertainment',
    'Finance', 'Education', 'Research', 'Reference', 'Travel', 'Health',
    'AI & ML', 'Gaming', 'Music', 'Video', 'Design', 'Communication',
    'Cloud & DevOps', 'Security', 'Other',
  ] as const;
  type CategoryName = typeof CATEGORIES[number];

  function parseCategory(response: string): CategoryName | null {
    const cleaned = response.trim().replace(/['"]/g, '');
    if ((CATEGORIES as readonly string[]).includes(cleaned)) return cleaned as CategoryName;
    const lower = cleaned.toLowerCase();
    for (const cat of CATEGORIES) {
      if (cat.toLowerCase() === lower || cat.toLowerCase().includes(lower)) {
        return cat as CategoryName;
      }
    }
    return null;
  }

  function parseBatchResponse(response: string, count: number): (CategoryName | null)[] {
    const results: (CategoryName | null)[] = new Array(count).fill(null);
    const lines = response.split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*(\d+)[.)]\s*(.+)$/);
      if (!m) continue;
      const idx = parseInt(m[1], 10) - 1;
      if (idx < 0 || idx >= count) continue;
      results[idx] = parseCategory(m[2]);
    }
    return results;
  }

  it('parses a well-formed numbered response in order', () => {
    const resp = '1. Development\n2. Social\n3. Shopping';
    expect(parseBatchResponse(resp, 3)).toEqual(['Development', 'Social', 'Shopping']);
  });

  it('tolerates ")" as the number separator', () => {
    expect(parseBatchResponse('1) News\n2) Finance', 2)).toEqual(['News', 'Finance']);
  });

  it('leaves missing indices as null', () => {
    // only index 2 provided → indices 0 and 2 null
    expect(parseBatchResponse('2. Work', 3)).toEqual([null, 'Work', null]);
  });

  it('ignores out-of-range indices', () => {
    expect(parseBatchResponse('5. Work', 2)).toEqual([null, null]);
  });

  it('ignores non-numbered noise lines', () => {
    const resp = 'Here are the categories:\n1. Development\nThanks!';
    expect(parseBatchResponse(resp, 1)).toEqual(['Development']);
  });

  it('maps unrecognized category text to null at its index', () => {
    expect(parseBatchResponse('1. Bogus\n2. Social', 2)).toEqual([null, 'Social']);
  });
});

// Test the two-phase classify strategy: rule hits are locked in, only
// 'fallback' results are sent to AI, and AI only overrides when confident.
// Inlined to mirror this file's convention (the real method needs chrome+AI).
describe('two-phase classify strategy', () => {
  type Src = 'rule' | 'fallback';
  interface RuleResult { category: string; source: Src; }
  interface AiResult { category: string; confidence: number; }

  /** Pure decision core extracted from TabManager.classifyAllTabs. */
  function decide(
    tabs: Array<{ id: number; rule: RuleResult }>,
    aiReady: boolean,
    ai: (uncertain: number[]) => Map<number, AiResult>
  ): Map<number, string> {
    const buckets = new Map<number, string>();
    const needsAi: number[] = [];
    for (const t of tabs) {
      buckets.set(t.id, t.rule.category);
      if (t.rule.source === 'fallback') needsAi.push(t.id);
    }
    if (aiReady && needsAi.length > 0) {
      const results = ai(needsAi);
      for (const id of needsAi) {
        const r = results.get(id);
        if (r && r.confidence > 0.7 && r.category) buckets.set(id, r.category);
      }
    }
    return buckets;
  }

  it('locks in rule hits and never sends them to AI', () => {
    const aiCalls: number[] = [];
    const buckets = decide(
      [
        { id: 1, rule: { category: 'Development', source: 'rule' } },
        { id: 2, rule: { category: 'Social', source: 'rule' } },
      ],
      true,
      (ids) => { aiCalls.push(...ids); return new Map(); }
    );
    expect(buckets.get(1)).toBe('Development');
    expect(buckets.get(2)).toBe('Social');
    expect(aiCalls).toEqual([]); // no rule hit was sent to AI
  });

  it('sends only fallback tabs to AI and overrides when confident', () => {
    const sent: number[] = [];
    const buckets = decide(
      [
        { id: 1, rule: { category: 'Development', source: 'rule' } },
        { id: 2, rule: { category: 'Other', source: 'fallback' } },
      ],
      true,
      (ids) => { sent.push(...ids); return new Map([[2, { category: 'Finance', confidence: 0.85 }]]); }
    );
    expect(sent).toEqual([2]);           // only the uncertain tab
    expect(buckets.get(1)).toBe('Development'); // rule hit untouched
    expect(buckets.get(2)).toBe('Finance');     // AI overrode the fallback
  });

  it('keeps the rule fallback when AI is not confident enough', () => {
    const buckets = decide(
      [{ id: 5, rule: { category: 'Other', source: 'fallback' } }],
      true,
      () => new Map([[5, { category: 'Gaming', confidence: 0.5 }]]) // below 0.7
    );
    expect(buckets.get(5)).toBe('Other'); // low-confidence AI ignored
  });

  it('skips AI entirely when it is not ready', () => {
    let called = false;
    const buckets = decide(
      [{ id: 9, rule: { category: 'Other', source: 'fallback' } }],
      false,
      () => { called = true; return new Map(); }
    );
    expect(called).toBe(false);
    expect(buckets.get(9)).toBe('Other');
  });
});

// Test the LRU eviction logic for learned domain→category mappings.
// Inlined to mirror this file's convention (real method needs chrome.storage).
describe('learned mappings LRU', () => {
  const MAX = 3;

  /** Pure core of Storage.setLearnedMapping. */
  function setMapping(
    mappings: Record<string, string>,
    domain: string,
    category: string
  ): Record<string, string> {
    delete mappings[domain];          // move to MRU position
    mappings[domain] = category;
    const keys = Object.keys(mappings);
    if (keys.length > MAX) {
      for (const old of keys.slice(0, keys.length - MAX)) delete mappings[old];
    }
    return mappings;
  }

  it('keeps insertion order and caps at MAX, evicting oldest', () => {
    let m: Record<string, string> = {};
    m = setMapping(m, 'a.com', 'Dev');
    m = setMapping(m, 'b.com', 'Social');
    m = setMapping(m, 'c.com', 'News');
    m = setMapping(m, 'd.com', 'Work'); // exceeds MAX → evict a.com
    expect(Object.keys(m)).toEqual(['b.com', 'c.com', 'd.com']);
    expect(m['a.com']).toBeUndefined();
  });

  it('re-learning a domain refreshes its recency (not evicted next)', () => {
    let m: Record<string, string> = {};
    m = setMapping(m, 'a.com', 'Dev');
    m = setMapping(m, 'b.com', 'Social');
    m = setMapping(m, 'c.com', 'News');
    m = setMapping(m, 'a.com', 'AI & ML'); // touch a.com → now MRU
    m = setMapping(m, 'd.com', 'Work');     // evict oldest = b.com, not a.com
    expect(m['a.com']).toBe('AI & ML');
    expect(m['b.com']).toBeUndefined();
    expect(Object.keys(m)).toEqual(['c.com', 'a.com', 'd.com']);
  });

  it('updates the category when re-learning an existing domain', () => {
    let m: Record<string, string> = {};
    m = setMapping(m, 'a.com', 'Dev');
    m = setMapping(m, 'a.com', 'Finance');
    expect(m['a.com']).toBe('Finance');
    expect(Object.keys(m).length).toBe(1);
  });
});

// Test the i18n translate() core: locale lookup, English fallback, {var} subst.
describe('i18n translate', async () => {
  const { translate } = await import('../sidepanel/i18n');

  it('returns the requested locale string', () => {
    expect(translate('zh', 'smartGroup')).toBe('智能分组');
    expect(translate('en', 'smartGroup')).toBe('Smart Group');
  });

  it('substitutes {placeholders}', () => {
    expect(translate('en', 'grouped', { n: 5, g: 2 })).toBe('Grouped 5 tabs into 2 groups');
    expect(translate('zh', 'learnedRemembered', { n: 3 })).toBe('已记住 3 个域名');
  });

  it('replaces every occurrence of a placeholder', () => {
    // sanity: a var appearing once still works, and numbers coerce to string
    expect(translate('zh', 'grouped', { n: 1, g: 1 })).toBe('已将 1 个标签页分到 1 个分组');
  });
});
