// TabCraft — proxy.ts tests: the host→route matching, verdict classification,
// and wording shared by the background controller client, the injected page
// badge, and the settings view.
import { describe, it, expect } from 'vitest';
import {
  describeVerdict,
  mergeRoutes,
  normalizeControllerUrl,
  resolveRoute,
  shortNodeName,
  toHostRoutes,
  verdictFor,
  type HostRoute,
  type ProxyConnection,
} from '../shared/proxy';

function route(host: string, seenAt: number, chains = ['node'], rule = ''): HostRoute {
  return { host, chains, rule, rulePayload: '', seenAt };
}

function memoOf(...routes: HostRoute[]): Map<string, HostRoute> {
  return new Map(routes.map((r) => [r.host, r]));
}

describe('normalizeControllerUrl', () => {
  it('accepts a bare host:port and qualifies the scheme', () => {
    expect(normalizeControllerUrl('127.0.0.1:9097')).toBe('http://127.0.0.1:9097');
  });

  it('keeps an explicit scheme and drops path and trailing slash', () => {
    expect(normalizeControllerUrl('http://127.0.0.1:9090/')).toBe('http://127.0.0.1:9090');
    expect(normalizeControllerUrl('https://box.lan:9090/ui')).toBe('https://box.lan:9090');
  });

  it('rejects input that cannot be a controller address', () => {
    expect(normalizeControllerUrl('')).toBeNull();
    expect(normalizeControllerUrl('   ')).toBeNull();
    expect(normalizeControllerUrl('http://')).toBeNull();
  });
});

describe('toHostRoutes', () => {
  const conn = (host: string, start: string, chains: string[]): ProxyConnection => ({
    metadata: { host },
    chains,
    rule: 'DomainSuffix',
    rulePayload: 'example.com',
    start,
  });

  it('keeps the newest connection per host', () => {
    const routes = toHostRoutes(
      [
        conn('a.com', '2026-08-20T10:00:00Z', ['old-node']),
        conn('a.com', '2026-08-20T10:05:00Z', ['new-node']),
      ],
      0
    );
    expect(routes).toHaveLength(1);
    expect(routes[0].chains).toEqual(['new-node']);
    expect(routes[0].seenAt).toBe(Date.parse('2026-08-20T10:05:00Z'));
  });

  it('skips connections with no host or no chain', () => {
    const routes = toHostRoutes(
      [
        { metadata: {}, chains: ['node'] },
        { metadata: { host: 'b.com' }, chains: [] },
        { metadata: { host: 'c.com' } },
      ],
      0
    );
    expect(routes).toEqual([]);
  });

  it('falls back to the sniffed host and to the observation time', () => {
    const routes = toHostRoutes([{ metadata: { sniffHost: 'D.com' }, chains: ['node'] }], 1234);
    expect(routes[0].host).toBe('d.com');
    expect(routes[0].seenAt).toBe(1234);
  });
});

describe('mergeRoutes', () => {
  it('replaces a route only with a newer observation', () => {
    const memo = memoOf(route('a.com', 200, ['keep']));
    mergeRoutes(memo, [route('a.com', 100, ['stale'])], 10);
    expect(memo.get('a.com')?.chains).toEqual(['keep']);
    mergeRoutes(memo, [route('a.com', 300, ['fresh'])], 10);
    expect(memo.get('a.com')?.chains).toEqual(['fresh']);
  });

  it('evicts the oldest hosts past the cap', () => {
    const memo = memoOf(route('old.com', 1), route('mid.com', 2));
    mergeRoutes(memo, [route('new.com', 3)], 2);
    expect([...memo.keys()].sort()).toEqual(['mid.com', 'new.com']);
  });
});

describe('resolveRoute', () => {
  it('prefers the host itself, ignoring a www. prefix', () => {
    const memo = memoOf(route('example.com', 1));
    expect(resolveRoute(memo, 'www.example.com')).toMatchObject({ match: 'exact' });
    expect(resolveRoute(memo, 'EXAMPLE.COM.')).toMatchObject({ match: 'exact' });
  });

  it('walks up to a parent domain before guessing', () => {
    const memo = memoOf(route('example.com', 1));
    const hit = resolveRoute(memo, 'deep.sub.example.com');
    expect(hit).toMatchObject({ match: 'parent' });
    expect(hit?.route.host).toBe('example.com');
  });

  it('borrows the newest sibling under the same registrable domain', () => {
    const memo = memoOf(route('cdn.example.com', 100), route('api.example.com', 300));
    const hit = resolveRoute(memo, 'shop.example.com');
    expect(hit).toMatchObject({ match: 'sibling' });
    expect(hit?.route.host).toBe('api.example.com');
  });

  it('never crosses a public suffix to reach an unrelated site', () => {
    // bbc.co.uk and example.co.uk share the co.uk suffix but not a registrable
    // domain: a route recorded for one must never describe the other.
    const memo = memoOf(route('bbc.co.uk', 1), route('news.bbc.co.uk', 2));
    expect(resolveRoute(memo, 'www.example.co.uk')).toBeNull();
  });

  it('returns null when nothing relates to the host', () => {
    expect(resolveRoute(memoOf(route('a.com', 1)), 'b.org')).toBeNull();
    expect(resolveRoute(memoOf(route('a.com', 1)), '')).toBeNull();
  });
});

describe('verdictFor', () => {
  it('reads the egress node from the chain head and groups outermost-first', () => {
    const resolved = {
      route: {
        host: 'github.com',
        // mihomo reports chains innermost-first: node, then each group it came through.
        chains: ['🇰🇷8韩国集群-全网优化(M)', '🔥ChatGPT', '狗狗加速.com'],
        rule: 'DomainKeyword',
        rulePayload: 'github',
        seenAt: 42,
      },
      match: 'exact' as const,
    };
    expect(verdictFor(resolved)).toEqual({
      kind: 'proxied',
      host: 'github.com',
      match: 'exact',
      node: '🇰🇷8韩国集群-全网优化(M)',
      groups: ['狗狗加速.com', '🔥ChatGPT'],
      rule: 'DomainKeyword(github)',
      seenAt: 42,
    });
  });

  it('classifies DIRECT and REJECT outbounds instead of naming them as nodes', () => {
    expect(verdictFor({ route: route('a.com', 1, ['DIRECT']), match: 'exact' })).toMatchObject({
      kind: 'direct',
    });
    expect(
      verdictFor({ route: route('ads.a.com', 1, ['REJECT-DROP']), match: 'exact' })
    ).toMatchObject({ kind: 'blocked' });
  });

  it('reports unknown when no route was found', () => {
    expect(verdictFor(null)).toEqual({ kind: 'unknown' });
  });
});

describe('shortNodeName', () => {
  it('drops the trailing line/protocol parenthetical', () => {
    expect(shortNodeName('🇰🇷8韩国集群-全网优化(M)')).toBe('🇰🇷8韩国集群-全网优化');
    expect(shortNodeName('HK-01 [AnyTLS]')).toBe('HK-01');
  });

  it('clips by grapheme so a flag emoji is never split', () => {
    const clipped = shortNodeName('🇰🇷'.repeat(30));
    expect(clipped.endsWith('…')).toBe(true);
    // 18 flags survive whole — a code-point clip would leave a stray half-flag.
    expect([...new Intl.Segmenter().segment(clipped)]).toHaveLength(19);
  });

  it('keeps a name that is only a parenthetical', () => {
    expect(shortNodeName('(M)')).toBe('(M)');
  });
});

describe('describeVerdict', () => {
  const proxied = verdictFor({
    route: {
      host: 'github.com',
      chains: ['🇰🇷8韩国集群-全网优化(M)', '狗狗加速.com'],
      rule: 'DomainKeyword',
      rulePayload: 'github',
      seenAt: 1,
    },
    match: 'exact' as const,
  });

  it('names the node and spells out the chain and rule', () => {
    const d = describeVerdict(proxied, 'en');
    expect(d.tone).toBe('proxy');
    expect(d.text).toBe('🇰🇷8韩国集群-全网优化');
    expect(d.detail).toEqual([
      'github.com',
      '🇰🇷8韩国集群-全网优化(M)',
      'via 狗狗加速.com',
      'matched DomainKeyword(github)',
    ]);
  });

  it('marks a borrowed route as inferred', () => {
    const borrowed = verdictFor({ route: route('api.example.com', 1, ['node']), match: 'sibling' });
    expect(describeVerdict(borrowed, 'en').detail).toContain('inferred from api.example.com');
  });

  it('localizes the non-proxied outcomes', () => {
    const direct = verdictFor({ route: route('mi.com', 1, ['DIRECT']), match: 'exact' });
    expect(describeVerdict(direct, 'zh').text).toBe('直连');
    expect(describeVerdict(direct, 'en').text).toBe('Direct');
    expect(describeVerdict({ kind: 'unknown' }, 'zh').tone).toBe('idle');
  });
});
