// TabCraft — format.ts tests: the memory-estimate string shown by the
// hibernation stats and the side panel's quick actions.
import { describe, it, expect } from 'vitest';
import { ESTIMATED_MB_PER_TAB, formatMemoryEstimate } from '../shared/format';

describe('formatMemoryEstimate', () => {
  it('reports megabytes up to the 1024 MB switch point', () => {
    expect(formatMemoryEstimate(0)).toBe('~0 MB');
    expect(formatMemoryEstimate(1)).toBe(`~${ESTIMATED_MB_PER_TAB} MB`);
    // 20 tabs = 1000 MB, still under the threshold.
    expect(formatMemoryEstimate(20)).toBe('~1000 MB');
  });

  it('switches to gigabytes with one decimal past 1024 MB', () => {
    // 21 tabs = 1050 MB, the first count that crosses over.
    expect(formatMemoryEstimate(21)).toBe('~1.0 GB');
    expect(formatMemoryEstimate(41)).toBe('~2.0 GB');
  });
});
