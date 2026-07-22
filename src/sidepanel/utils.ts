// TabCraft — Side panel shared utilities

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
