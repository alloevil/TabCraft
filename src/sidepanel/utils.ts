// TabCraft — Side panel shared utilities

import type { Message } from '../shared/types';

/** Typed wrapper over chrome.runtime.sendMessage — the side panel's single
 *  boundary to the background's message protocol. Only `Message` variants
 *  compile, so a typo'd action or missing payload is a build error instead
 *  of a runtime "Unknown action" reply. */
export function sendMessage<T = unknown>(message: Message): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

/** Focus a tab's window and activate the tab — the "jump to this tab"
 *  action used by TabItem and DedupView. Focusing the window first matters
 *  for tabs that live in a different (background) window: chrome.tabs.update
 *  alone activates the tab within its window but does not bring that
 *  window to the front. */
export async function focusTab(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.windowId != null) {
    await chrome.windows.update(tab.windowId, { focused: true });
  }
  if (tab.id != null) {
    await chrome.tabs.update(tab.id, { active: true });
  }
}
