// @vitest-environment jsdom
// TabCraft — DedupView component tests: the duplicate list UI, keep-tab
// auto-selection, toggling, and the two merge actions (the only sidepanel
// view with real decision logic).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { installChromeMock, makeTab } from './helpers/chrome-mock';
import { DedupView } from '../sidepanel/components/DedupView';

const mock = installChromeMock();

function seedTwoWindowsWithDuplicates() {
  // Same page open in two windows (tab 2 is active → must be kept),
  // plus one unique tab that must never appear in the list.
  mock.setWindows([
    {
      id: 1,
      tabs: [
        makeTab({
          id: 1,
          windowId: 1,
          url: 'https://a.com/x',
          title: 'Copy One',
          lastAccessed: 100,
        }),
        makeTab({ id: 3, windowId: 1, url: 'https://unique.com', title: 'Unique' }),
      ],
    },
    {
      id: 2,
      tabs: [
        makeTab({
          id: 2,
          windowId: 2,
          url: 'https://www.a.com/x/',
          title: 'Copy Two',
          active: true,
          lastAccessed: 50,
        }),
      ],
    },
  ]);
}

beforeEach(() => {
  cleanup();
  mock.removedTabIds.length = 0;
  seedTwoWindowsWithDuplicates();
});

describe('DedupView', () => {
  it('lists duplicate groups (normalized across www/trailing slash) and skips unique tabs', async () => {
    render(<DedupView onRefresh={() => {}} />);
    expect(await screen.findByText('Copy One')).toBeDefined();
    expect(screen.getByText('Copy Two')).toBeDefined();
    expect(screen.getByText('2 tabs')).toBeDefined(); // group size badge
    expect(screen.getByText('Cross-Window')).toBeDefined();
    expect(screen.queryByText('Unique')).toBeNull();
  });

  it('auto-selects the active tab as the one to keep', async () => {
    render(<DedupView onRefresh={() => {}} />);
    const keepRow = (await screen.findByText('Copy Two')).closest('.dedup-tab');
    const removeRow = screen.getByText('Copy One').closest('.dedup-tab');
    expect(keepRow?.className).toContain('keep');
    expect(removeRow?.className).toContain('remove');
  });

  it('merge-all closes every tab except the kept one and rescans', async () => {
    const onRefresh = vi.fn();
    render(<DedupView onRefresh={onRefresh} />);
    await screen.findByText('Copy One');

    fireEvent.click(screen.getByText(/Merge All Duplicates/));

    await waitFor(() => expect(mock.removedTabIds).toEqual([1])); // active tab 2 kept
    expect(onRefresh).toHaveBeenCalled();
    expect(await screen.findByText(/No duplicates found/)).toBeDefined(); // post-merge rescan
  });

  it('clicking a tab re-selects it as the keeper; merge-selected honors that choice', async () => {
    const onRefresh = vi.fn();
    render(<DedupView onRefresh={onRefresh} />);
    const row = (await screen.findByText('Copy One')).closest('.dedup-tab');
    expect(row).not.toBeNull();

    fireEvent.click(row!); // user overrides the auto-selection → keep tab 1
    expect(row?.className).toContain('keep');

    fireEvent.click(screen.getByText(/Merge Selected/));
    await waitFor(() => expect(mock.removedTabIds).toEqual([2])); // tab 2 closed instead
    expect(onRefresh).toHaveBeenCalled();
  });
});
