// TabCraft — Storage tests against the REAL implementation (chrome.storage
// mocked in memory). Previously these behaviors were "tested" via inline
// re-implementations that could pass while the real code regressed.
import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeMock } from './helpers/chrome-mock';
import { MAX_LEARNED_MAPPINGS } from '../shared/constants';
import { Storage } from '../background/storage';

// Installed at module scope: storage.ts only touches chrome lazily (its
// import-time onChanged registration is guarded), so the mock just has to
// exist before the first Storage call in a test.
const mock = installChromeMock();

beforeEach(async () => {
  await Storage.clearLearnedMappings();
});

describe('Storage.addLearnedMappings (real LRU)', () => {
  it('stores a batch and reads it back', async () => {
    await Storage.addLearnedMappings([
      { domain: 'a.com', category: 'Development' },
      { domain: 'b.com', category: 'Social' },
    ]);
    expect(await Storage.getLearnedMappings()).toEqual({
      'a.com': 'Development',
      'b.com': 'Social',
    });
    expect(await Storage.getLearnedMappingCount()).toBe(2);
  });

  it('evicts the oldest entries past MAX_LEARNED_MAPPINGS', async () => {
    const entries = Array.from({ length: MAX_LEARNED_MAPPINGS + 2 }, (_, i) => ({
      domain: `site${i}.com`,
      category: 'News',
    }));
    await Storage.addLearnedMappings(entries);
    const mappings = await Storage.getLearnedMappings();
    expect(Object.keys(mappings)).toHaveLength(MAX_LEARNED_MAPPINGS);
    // The two oldest were evicted; the newest survive.
    expect(mappings['site0.com']).toBeUndefined();
    expect(mappings['site1.com']).toBeUndefined();
    expect(mappings[`site${MAX_LEARNED_MAPPINGS + 1}.com`]).toBe('News');
  });

  it('re-learning a domain refreshes its recency so it is not evicted next', async () => {
    // Fill to exactly the cap, oldest = keep.com.
    await Storage.addLearnedMappings([{ domain: 'keep.com', category: 'Music' }]);
    await Storage.addLearnedMappings(
      Array.from({ length: MAX_LEARNED_MAPPINGS - 1 }, (_, i) => ({
        domain: `filler${i}.com`,
        category: 'News',
      }))
    );
    // Touch keep.com (now MRU), then push one more to force an eviction.
    await Storage.addLearnedMappings([{ domain: 'keep.com', category: 'AI & ML' }]);
    await Storage.addLearnedMappings([{ domain: 'new.com', category: 'Work' }]);

    const mappings = await Storage.getLearnedMappings();
    expect(mappings['keep.com']).toBe('AI & ML'); // survived + category updated
    expect(mappings['filler0.com']).toBeUndefined(); // oldest evicted instead
    expect(mappings['new.com']).toBe('Work');
  });

  it('skips entries with an empty domain', async () => {
    await Storage.addLearnedMappings([
      { domain: '', category: 'Development' },
      { domain: 'a.com', category: 'Social' },
    ]);
    expect(Object.keys(await Storage.getLearnedMappings())).toEqual(['a.com']);
  });

  it('setLearnedMapping is a single-entry batch', async () => {
    await Storage.setLearnedMapping('solo.com', 'Design');
    expect(await Storage.getLearnedMappings()).toEqual({ 'solo.com': 'Design' });
  });

  it('clearLearnedMappings empties the store', async () => {
    await Storage.setLearnedMapping('a.com', 'Design');
    await Storage.clearLearnedMappings();
    expect(await Storage.getLearnedMappingCount()).toBe(0);
    expect(mock.store['learnedMappings']).toEqual({});
  });
});
