// TabCraft — Chrome API Type Augmentation
// Extends Chrome types for APIs not yet in @types/chrome

declare namespace chrome {
  namespace tabGroups {
    interface TabGroup {
      id: number;
      windowId: number;
      title?: string;
      color: ColorEnum;
      collapsed: boolean;
    }

    type ColorEnum = 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange' | 'grey';

    interface QueryInfo {
      windowId?: number;
    }

    function query(queryInfo: QueryInfo): Promise<TabGroup[]>;
    function update(groupId: number, updateProperties: {
      title?: string;
      color?: ColorEnum;
      collapsed?: boolean;
    }): Promise<void>;

    const onCreated: chrome.events.Event<(group: TabGroup) => void>;
    const onUpdated: chrome.events.Event<(group: TabGroup) => void>;
    const onRemoved: chrome.events.Event<(group: TabGroup) => void>;
  }

  namespace tabs {
    interface Tab {
      id?: number;
      windowId: number;
      url?: string;
      title?: string;
      favIconUrl?: string;
      groupId?: number;
      pinned: boolean;
      active: boolean;
      lastAccessed?: number;
      discarded: boolean;
      status: 'loading' | 'complete';
      audible?: boolean;
    }

    function group(options: { tabIds: number[]; groupId?: number }): Promise<number>;
    function ungroup(tabIds: number | number[]): Promise<void>;
    function discard(tabId: number): Promise<void>;
  }

  namespace ai {
    function canCreateTextSession(): Promise<'readily' | 'after-download' | 'no'>;
    function createTextSession(): Promise<{ prompt: (text: string) => Promise<string>; destroy: () => void }>;
  }

  namespace windows {
    const WINDOW_ID_CURRENT: number;
  }

  namespace contextMenus {
    function create(createProperties: {
      id: string;
      title: string;
      contexts: string[];
    }): void;

    const onClicked: chrome.events.Event<(info: { menuItemId: string }) => void>;
  }

  namespace commands {
    const onCommand: chrome.events.Event<(command: string) => void>;
  }
}
