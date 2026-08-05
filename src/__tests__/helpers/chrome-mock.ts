// TabCraft — Test helper: minimal in-memory chrome.* mock.
//
// Backs chrome.storage.local with a plain object and provides just enough
// surface for the background modules under test. Install BEFORE dynamically
// importing any module that touches chrome at module scope (e.g. storage.ts
// registers a storage.onChanged listener at import time).

export interface ChromeMock {
  /** The backing store for chrome.storage.local — inspect/seed directly. */
  store: Record<string, unknown>;
  /** tab ids passed to chrome.tabs.remove, in call order. */
  removedTabIds: number[];
  /** Replace the result of chrome.windows.getAll. */
  setWindows(windows: Array<{ id: number; tabs: chrome.tabs.Tab[] }>): void;
}

export function installChromeMock(): ChromeMock {
  const store: Record<string, unknown> = {};
  const removedTabIds: number[] = [];
  let windows: Array<{ id: number; tabs: chrome.tabs.Tab[] }> = [];

  const chromeMock = {
    storage: {
      local: {
        get: (key: string | null, cb: (r: Record<string, unknown>) => void) => {
          cb(key === null ? { ...store } : { [key]: store[key] });
        },
        set: (obj: Record<string, unknown>, cb?: () => void) => {
          Object.assign(store, obj);
          cb?.();
        },
        remove: (key: string, cb?: () => void) => {
          delete store[key];
          cb?.();
        },
        clear: (cb?: () => void) => {
          for (const k of Object.keys(store)) delete store[k];
          cb?.();
        },
      },
      onChanged: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
    windows: {
      getAll: async () => windows,
      update: async () => {},
    },
    tabs: {
      remove: async (tabId: number) => {
        removedTabIds.push(tabId);
        windows = windows.map((w) => ({
          ...w,
          tabs: w.tabs.filter((t) => t.id !== tabId),
        }));
      },
      update: async () => {},
      query: async () => windows.flatMap((w) => w.tabs),
    },
  };

  // Boundary cast: the mock intentionally implements only the surface the
  // modules under test consume, not the full chrome typings.
  Object.assign(globalThis, { chrome: chromeMock as unknown as typeof chrome });

  return {
    store,
    removedTabIds,
    setWindows(next) {
      windows = next;
    },
  };
}

/** Build a minimal chrome.tabs.Tab for tests. Boundary cast: real Tab has a
 *  dozen required fields irrelevant to the code under test. */
export function makeTab(partial: Partial<chrome.tabs.Tab> & { id: number }): chrome.tabs.Tab {
  return partial as unknown as chrome.tabs.Tab;
}
