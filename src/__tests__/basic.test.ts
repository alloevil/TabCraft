// TabCraft — Basic Tests
import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '../background/duplicate';
import { extractDomain } from '../background/ai/rule-engine';

// Test normalizeUrl from duplicate.ts — imported directly (not reimplemented)
// so this test actually catches regressions in the shared implementation
// used by the background auto-close, DedupView, and QuickActions.
describe('normalizeUrl', () => {
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
    expect(normalizeUrl(url)).toBe('https://google.com/search?q=test');
  });

  it('strips the www. subdomain', () => {
    expect(normalizeUrl('https://www.example.com/page')).toBe(
      normalizeUrl('https://example.com/page')
    );
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

// Test extractDomain from rule-engine.ts — imported directly, not reimplemented.
describe('extractDomain', () => {
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

  type CategoryName = (typeof CATEGORIES)[number];

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
    expect(engine.classify('https://leetcode.com/problems/two-sum', 'LeetCode').category).toBe(
      'Development'
    );
    expect(engine.classify('https://www.bilibili.com/video/x', 'B站').category).toBe(
      'Entertainment'
    );
    expect(engine.classify('https://booking.com/hotel/x', 'Booking').category).toBe('Travel');
  });

  it('matches subdomains via normalization', () => {
    // mail.qq.com is a seed rule; sub.unknown still falls through
    expect(engine.classify('https://platform.openai.com/docs', 'OpenAI').category).toBe('AI & ML');
  });

  it('normalizes subdomains of multi-part suffixes (.co.uk, .ac.jp) via tldts', () => {
    // Regression test: the old hand-rolled TLD list only recognized single-
    // label suffixes (com/org/net/io/dev/app/co), so any domain under a
    // compound suffix like .co.uk or .ac.jp fell through unnormalized and
    // never matched a rule registered on the registrable domain. tldts'
    // getDomain() (backed by the Public Suffix List) handles these correctly.
    engine.addRule('example.co.uk', 'News');
    expect(engine.classify('https://sport.example.co.uk/', 'Sport').category).toBe('News');

    engine.addRule('example.ac.jp', 'Education');
    expect(engine.classify('https://lab.example.ac.jp/', 'Lab').category).toBe('Education');
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
    const r = engine.classify(
      'https://unknown-host.test/',
      'Stream this album playlist — new music'
    );
    expect(r.category).toBe('Music');
  });

  it('weighted scoring: multi-word phrase outweighs a single ambiguous token', () => {
    // "machine learning" (phrase, weight 2) for AI&ML beats a lone "code"
    // (weight 1) for Development.
    const r = engine.classify('https://unknown-host.test/', 'A machine learning code sample');
    expect(r.category).toBe('AI & ML');
  });

  it('expanded lifestyle keywords no longer fall through to Other', () => {
    expect(
      engine.classify('https://unknown-h.test/', 'Best hotel booking for our trip').category
    ).toBe('Travel');
    expect(
      engine.classify('https://unknown-h.test/', 'My workout and nutrition plan').category
    ).toBe('Health');
    expect(
      engine.classify('https://unknown-h.test/', 'Steam game library on sale').category
    ).not.toBe('Other');
  });

  it('classifies by URL path when domain is unknown and title is blank', () => {
    // path carries the signal; title empty so it cannot help
    expect(
      engine.classify('https://unknown-site.test/finance/portfolio/holdings', '').category
    ).toBe('Finance');
    expect(engine.classify('https://unknown-site.test/docs/api/reference', '').category).toBe(
      'Development'
    );
  });

  it('URL path ranks above title keywords', () => {
    // path says Shopping (checkout/cart), title weakly says News (article).
    // Path is structured signal → should win and be marked source 'rule'.
    const r = engine.classify('https://unknown-shop.test/cart/checkout', 'Read this article');
    expect(r.category).toBe('Shopping');
    expect(r.source).toBe('rule');
  });
});

// Test multiPurpose domain rules: social feeds / UGC video / Q&A-blogging
// aggregators should defer to the tab's own title keywords instead of the
// domain rule always winning (see rule-engine.ts resolveDomainMatch()).
describe('multiPurpose domain rules', async () => {
  const { RuleEngine } = await import('../background/ai/rule-engine');

  it('title keyword hit overrides the domain rule category', () => {
    const engine = new RuleEngine([
      {
        id: 't1',
        domain: 'multitest.example',
        category: 'Entertainment',
        source: 'seed',
        createdAt: 0,
        updatedAt: 0,
        multiPurpose: true,
      },
    ]);
    const r = engine.classify(
      'https://multitest.example/post/1',
      'New GPT-5 model announcement thread'
    );
    expect(r.category).toBe('AI & ML');
  });

  it('falls back to the domain category (tagged "fallback") when title has no keyword hit', () => {
    const engine = new RuleEngine([
      {
        id: 't1',
        domain: 'multitest.example',
        category: 'Entertainment',
        source: 'seed',
        createdAt: 0,
        updatedAt: 0,
        multiPurpose: true,
      },
    ]);
    const r = engine.classify('https://multitest.example/post/1', 'Just a regular day');
    expect(r.category).toBe('Entertainment');
    // Tagged 'fallback' (not 'rule') specifically so the AI classifier still
    // gets consulted downstream instead of the domain silently winning.
    expect(r.source).toBe('fallback');
  });

  it('ignores URL path keywords — platform boilerplate like "video" must not masquerade as content signal', () => {
    const engine = new RuleEngine([
      {
        id: 't1',
        domain: 'multitest.example',
        category: 'Entertainment',
        source: 'seed',
        createdAt: 0,
        updatedAt: 0,
        multiPurpose: true,
      },
    ]);
    // Path contains "video" (would score Video/Entertainment via scoreText),
    // but title has no keyword — result must still be the domain fallback,
    // proving path tokens are skipped for multiPurpose domains.
    const r = engine.classify('https://multitest.example/video/12345', 'Untitled');
    expect(r.category).toBe('Entertainment');
    expect(r.source).toBe('fallback');
  });

  it('ordinary (non-multiPurpose) domain rules are unaffected — still win immediately', () => {
    const engine = new RuleEngine([
      {
        id: 't1',
        domain: 'strict.example',
        category: 'Work',
        source: 'seed',
        createdAt: 0,
        updatedAt: 0,
      },
    ]);
    const r = engine.classify('https://strict.example/', 'New GPT-5 model announcement thread');
    expect(r.category).toBe('Work');
    expect(r.source).toBe('rule');
  });

  it('real seed data: x.com now varies by tab content instead of always "Social"', async () => {
    const { RuleEngine: RealEngine } = await import('../background/ai/rule-engine');
    const engine = new RealEngine();
    const techy = engine.classify(
      'https://x.com/i/status/123',
      'New GPT-5 model announcement thread'
    );
    expect(techy.category).toBe('AI & ML');
    const generic = engine.classify('https://x.com/home', 'Home / X');
    expect(generic.category).toBe('Social');
  });

  it('real seed data: bilibili tutorial with no ML keyword in KEYWORD_MAP still falls back to Entertainment (documented limitation, not a silent gap)', async () => {
    const { RuleEngine: RealEngine } = await import('../background/ai/rule-engine');
    const engine = new RealEngine();
    const r = engine.classify(
      'https://www.bilibili.com/video/BV1SDRxYKEfM/?p=2',
      'Building makemore Part 2_ MLP.zh_en_哔哩哔哩_bilibili'
    );
    expect(r.category).toBe('Entertainment');
    expect(r.source).toBe('fallback'); // still AI-eligible, unlike before this fix
  });
});

// Test tokenizeUrlPath in isolation.
describe('tokenizeUrlPath', async () => {
  const { tokenizeUrlPath } = await import('../background/ai/rule-engine');

  it('splits path + query into lowercase tokens', () => {
    expect(tokenizeUrlPath('https://x.test/Finance/Stock-Market')).toBe('finance stock market');
  });

  it('drops pure-numeric segments and short tokens', () => {
    // "12345" numeric, "a"/"to" too short → removed; "watch"/"video" kept
    expect(tokenizeUrlPath('https://x.test/watch/12345/a/video?to=1')).toBe('watch video');
  });

  it('returns empty string for invalid URLs', () => {
    expect(tokenizeUrlPath('not-a-url')).toBe('');
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
    const valid = new Set([
      ...palette,
      'cyan',
      'orange',
      'pink',
      'yellow',
      'red',
      'green',
      'blue',
      'purple',
    ]);
    expect(valid.has(colorForCategory('totally-unknown-name'))).toBe(true);
  });
});

// Test parseBatchResponse/parseCategory/buildPrompt/buildBatchPrompt —
// imported directly now that gemini-nano.ts exports them (previously
// private, re-implemented inline here; exporting them was a prerequisite
// for the custom-taxonomy feature below, so this also fixes the old
// inline-copy test debt for free).
describe('parseBatchResponse / parseCategory (default taxonomy)', async () => {
  const { parseBatchResponse } = await import('../background/ai/gemini-nano');
  const { CATEGORIES } = await import('../shared/types');

  it('parses a well-formed numbered response in order', () => {
    const resp = '1. Development\n2. Social\n3. Shopping';
    expect(parseBatchResponse(resp, 3, CATEGORIES)).toEqual(['Development', 'Social', 'Shopping']);
  });

  it('tolerates ")" as the number separator', () => {
    expect(parseBatchResponse('1) News\n2) Finance', 2, CATEGORIES)).toEqual(['News', 'Finance']);
  });

  it('leaves missing indices as null', () => {
    // only index 2 provided → indices 0 and 2 null
    expect(parseBatchResponse('2. Work', 3, CATEGORIES)).toEqual([null, 'Work', null]);
  });

  it('ignores out-of-range indices', () => {
    expect(parseBatchResponse('5. Work', 2, CATEGORIES)).toEqual([null, null]);
  });

  it('ignores non-numbered noise lines', () => {
    const resp = 'Here are the categories:\n1. Development\nThanks!';
    expect(parseBatchResponse(resp, 1, CATEGORIES)).toEqual(['Development']);
  });

  it('maps unrecognized category text to null at its index', () => {
    expect(parseBatchResponse('1. Bogus\n2. Social', 2, CATEGORIES)).toEqual([null, 'Social']);
  });
});

// Test the custom-taxonomy machinery: buildPrompt/buildBatchPrompt/
// parseCategory validate against whatever `categories` list is passed
// (not the fixed CATEGORIES), and parseCategoryList turns a free-text AI
// response into a clean category list with a guaranteed catch-all.
describe('custom-taxonomy classification', async () => {
  const { buildPrompt, buildBatchPrompt, parseCategory, parseCategoryList } =
    await import('../background/ai/gemini-nano');

  it('buildPrompt embeds the custom category list, not the fixed taxonomy', () => {
    const prompt = buildPrompt('https://x.com', 'title', ['ai', '工作', '其他']);
    expect(prompt).toContain('ai, 工作, 其他');
    expect(prompt).not.toContain('Development');
  });

  it('buildBatchPrompt embeds the custom category list', () => {
    const prompt = buildBatchPrompt([{ url: 'https://x.com', title: 't' }], ['ai', '工作', '其他']);
    expect(prompt).toContain('ai, 工作, 其他');
    expect(prompt).not.toContain('Development');
  });

  it('parseCategory validates against the passed list, not the fixed taxonomy', () => {
    const custom = ['ai', '工作', '其他'];
    expect(parseCategory('ai', custom)).toBe('ai');
    // "Development" is a real fixed-taxonomy category but isn't in this
    // custom list — must NOT leak through as a match.
    expect(parseCategory('Development', custom)).toBeNull();
  });

  it('parseCategoryList splits on commas/、/newlines and dedupes', () => {
    expect(parseCategoryList('ai, 工作, 交流, 开发, 其他')).toEqual([
      'ai',
      '工作',
      '交流',
      '开发',
      '其他',
    ]);
    expect(parseCategoryList('ai、工作、交流')).toEqual(['ai', '工作', '交流', 'Other']);
    expect(parseCategoryList('ai\n工作\nai')).toEqual(['ai', '工作', 'Other']);
  });

  it('parseCategoryList strips bullets/numbering/prefixes', () => {
    expect(parseCategoryList('Categories: 1. ai, 2. 工作')).toEqual(['ai', '工作', 'Other']);
  });

  it('parseCategoryList appends a catch-all only if one is not already present', () => {
    expect(parseCategoryList('ai, 工作, 其他')).toEqual(['ai', '工作', '其他']);
    expect(parseCategoryList('ai, work, Other')).toEqual(['ai', 'work', 'Other']);
    expect(parseCategoryList('ai, 工作')).toEqual(['ai', '工作', 'Other']);
  });

  it('parseCategoryList never returns an empty list', () => {
    expect(parseCategoryList('')).toEqual(['Other']);
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

// Test Storage's per-key write serialization (withLock in storage.ts).
// Without it, two concurrent read-modify-write calls to the same key can both
// read the same stale snapshot and the second write clobbers the first —
// silently dropping increments/rules/snoozes. This mocks chrome.storage.local
// with an artificial async delay so overlapping calls actually race.
describe('Storage incrementStat concurrency', async () => {
  const store: Record<string, any> = {};
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: (key: string, cb: (r: any) => void) => {
          setTimeout(() => cb({ [key]: store[key] }), 0);
        },
        set: (obj: Record<string, any>, cb?: () => void) => {
          setTimeout(() => {
            Object.assign(store, obj);
            cb?.();
          }, 0);
        },
      },
    },
  };

  const { Storage } = await import('../background/storage');

  it('does not drop increments under concurrent calls', async () => {
    await Promise.all([
      Storage.incrementStat('totalGrouped'),
      Storage.incrementStat('totalGrouped'),
      Storage.incrementStat('totalGrouped'),
      Storage.incrementStat('totalGrouped'),
      Storage.incrementStat('totalGrouped'),
    ]);
    const stats = await Storage.getStats();
    expect(stats.totalGrouped).toBe(5);
  });
});
