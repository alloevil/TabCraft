// TabCraft — TabManager tests against the REAL two-phase classification
// pipeline (rule engine + injected scripted classifier), replacing the old
// inline re-implementation that could pass while the real code regressed.
import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeMock, makeTab } from './helpers/chrome-mock';
import type { ClassificationResult } from '../shared/types';
import type { AiClassifier } from '../background/tab-manager';
import { TabManager } from '../background/tab-manager';
import { Storage } from '../background/storage';
import { DEFAULT_SETTINGS } from '../shared/constants';

const mock = installChromeMock();

/** Scripted classifier: records what the pipeline sends it, answers from a
 *  fixed url→result table. */
class FakeClassifier implements AiClassifier {
  batchCalls: Array<Array<{ url: string; title: string }>> = [];
  singleCalls: Array<{ url: string; title: string }> = [];
  ready = true;
  verdicts: Record<string, ClassificationResult> = {};

  async init(): Promise<boolean> {
    return this.ready;
  }

  async classify(url: string, title: string): Promise<ClassificationResult> {
    this.singleCalls.push({ url, title });
    return this.verdicts[url] ?? { category: 'Other', confidence: 0, source: 'ai' };
  }

  async classifyBatch(
    tabs: Array<{ url: string; title: string }>
  ): Promise<ClassificationResult[]> {
    this.batchCalls.push(tabs);
    return tabs.map(
      (t) => this.verdicts[t.url] ?? { category: 'Other', confidence: 0, source: 'ai' }
    );
  }

  async extractCategories(): Promise<string[] | null> {
    return null;
  }
}

let fake: FakeClassifier;
let tm: TabManager;

beforeEach(async () => {
  for (const k of Object.keys(mock.store)) delete mock.store[k];
  // Through updateSettings, not a raw store write — Storage memoizes settings
  // and the mock's onChanged never fires, so only the write-through path
  // keeps the memo coherent.
  await Storage.updateSettings({ ...DEFAULT_SETTINGS, learnFromActivity: true });
  await Storage.clearLearnedMappings();
  fake = new FakeClassifier();
  tm = new TabManager(fake);
  await tm.init();
});

// A URL whose domain has no seed rule and whose title/path carry no keyword
// signal — guaranteed to come out of the rule engine as source 'fallback'.
const UNKNOWN_URL = 'https://zzqx.example/xkcd9';
const UNKNOWN_TITLE = 'qwzx';

describe('TabManager.classifyAllTabs (two-phase, real pipeline)', () => {
  it('locks in rule hits and never sends them to AI', async () => {
    const tabs = [
      makeTab({ id: 1, url: 'https://github.com/foo/bar', title: 'repo' }),
      makeTab({ id: 2, url: 'https://figma.com/file/1', title: 'design file' }),
    ];
    const buckets = await tm.classifyAllTabs(tabs, 'smart');
    expect(buckets.get(1)).toBe('Development'); // seed rule
    expect(buckets.get(2)).toBe('Design'); // seed rule
    expect(fake.batchCalls).toEqual([]); // AI never consulted
  });

  it('sends only fallback tabs to AI in one batch and applies confident verdicts', async () => {
    fake.verdicts[UNKNOWN_URL] = { category: 'Finance', confidence: 0.9, source: 'ai' };
    const tabs = [
      makeTab({ id: 1, url: 'https://github.com/foo', title: 'repo' }),
      makeTab({ id: 2, url: UNKNOWN_URL, title: UNKNOWN_TITLE }),
    ];
    const buckets = await tm.classifyAllTabs(tabs, 'smart');
    expect(fake.batchCalls).toHaveLength(1);
    expect(fake.batchCalls[0].map((t) => t.url)).toEqual([UNKNOWN_URL]); // only the uncertain tab
    expect(buckets.get(1)).toBe('Development'); // rule hit untouched
    expect(buckets.get(2)).toBe('Finance'); // confident AI override
  });

  it('keeps the rule fallback when the AI is not confident enough', async () => {
    fake.verdicts[UNKNOWN_URL] = { category: 'Gaming', confidence: 0.5, source: 'ai' };
    const tabs = [makeTab({ id: 5, url: UNKNOWN_URL, title: UNKNOWN_TITLE })];
    const buckets = await tm.classifyAllTabs(tabs, 'smart');
    expect(buckets.get(5)).toBe('Other'); // low-confidence AI ignored
  });

  it('skips AI entirely when it failed to initialize', async () => {
    const offline = new FakeClassifier();
    offline.ready = false;
    const tmOffline = new TabManager(offline);
    await tmOffline.init();
    const buckets = await tmOffline.classifyAllTabs(
      [makeTab({ id: 9, url: UNKNOWN_URL, title: UNKNOWN_TITLE })],
      'smart'
    );
    expect(offline.batchCalls).toEqual([]);
    expect(buckets.get(9)).toBe('Other');
  });

  it('groups by domain without any AI involvement in domain mode', async () => {
    const buckets = await tm.classifyAllTabs(
      [makeTab({ id: 1, url: 'https://github.com/foo', title: 'repo' })],
      'domain'
    );
    expect(buckets.get(1)).toBe('GitHub'); // friendly name
    expect(fake.batchCalls).toEqual([]);
  });
});

describe('AI feedback → learned mappings (real persistence path)', () => {
  it('persists confident non-Other verdicts as learned mappings', async () => {
    fake.verdicts[UNKNOWN_URL] = { category: 'Finance', confidence: 0.9, source: 'ai' };
    await tm.classifyAllTabs([makeTab({ id: 2, url: UNKNOWN_URL, title: UNKNOWN_TITLE })], 'smart');
    expect(await Storage.getLearnedMappings()).toEqual({ 'zzqx.example': 'Finance' });
  });

  it('never learns "Other" or low-confidence verdicts', async () => {
    fake.verdicts['https://aa.example/x'] = { category: 'Other', confidence: 0.95, source: 'ai' };
    fake.verdicts['https://bb.example/x'] = { category: 'Music', confidence: 0.5, source: 'ai' };
    await tm.classifyAllTabs(
      [
        makeTab({ id: 1, url: 'https://aa.example/x', title: UNKNOWN_TITLE }),
        makeTab({ id: 2, url: 'https://bb.example/x', title: UNKNOWN_TITLE }),
      ],
      'smart'
    );
    expect(await Storage.getLearnedMappings()).toEqual({});
  });

  it('does not persist anything on a learn:false dry run (preview)', async () => {
    fake.verdicts[UNKNOWN_URL] = { category: 'Finance', confidence: 0.9, source: 'ai' };
    await tm.classifyAllTabs(
      [makeTab({ id: 2, url: UNKNOWN_URL, title: UNKNOWN_TITLE })],
      'smart',
      {
        learn: false,
      }
    );
    expect(await Storage.getLearnedMappings()).toEqual({});
  });

  it('honors the learnFromActivity opt-out', async () => {
    await Storage.updateSettings({ learnFromActivity: false });
    fake.verdicts[UNKNOWN_URL] = { category: 'Finance', confidence: 0.9, source: 'ai' };
    await tm.classifyAllTabs([makeTab({ id: 2, url: UNKNOWN_URL, title: UNKNOWN_TITLE })], 'smart');
    expect(await Storage.getLearnedMappings()).toEqual({});
  });

  it('a learned mapping wins on the next classification without AI', async () => {
    fake.verdicts[UNKNOWN_URL] = { category: 'Finance', confidence: 0.9, source: 'ai' };
    await tm.classifyAllTabs([makeTab({ id: 2, url: UNKNOWN_URL, title: UNKNOWN_TITLE })], 'smart');
    fake.batchCalls = [];
    const buckets = await tm.classifyAllTabs(
      [makeTab({ id: 3, url: UNKNOWN_URL, title: UNKNOWN_TITLE })],
      'smart'
    );
    expect(buckets.get(3)).toBe('Finance'); // learned mapping hit
    expect(fake.batchCalls).toEqual([]); // no second AI round-trip
  });
});

describe('TabManager.classifyTab (single-tab corroboration)', () => {
  it('treats a low-confidence AI verdict agreeing with the rule guess as corroboration', async () => {
    // "meeting" is a Work keyword → weak title-based fallback guess.
    const url = 'https://cc.example/x';
    fake.verdicts[url] = { category: 'Work', confidence: 0.5, source: 'ai' };
    const result = await tm.classifyTab(makeTab({ id: 1, url, title: 'meeting notes' }));
    expect(result.category).toBe('Work');
    expect(result.source).toBe('fallback'); // rule result kept, confidence boosted
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });
});
