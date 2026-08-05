// TabCraft — Quick Actions (One-click operations like OneTab)

import React, { useState, useEffect } from 'react';
import { formatMemoryEstimate } from '../../shared/format';
import { sendMessage } from '../utils';

interface QuickActionsProps {
  onRefresh: () => void;
}

export function QuickActions({ onRefresh }: QuickActionsProps) {
  const [tabCount, setTabCount] = useState(0);
  const [memoryInfo, setMemoryInfo] = useState('');
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [customInstruction, setCustomInstruction] = useState('');
  const [customStatus, setCustomStatus] = useState('');
  const [customBusy, setCustomBusy] = useState(false);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [previewCategories, setPreviewCategories] = useState<string[] | null>(null);

  useEffect(() => {
    updateStats();
    // Check AI availability upfront so the custom-group input can be
    // disabled with a clear reason instead of letting the user type an
    // instruction and only discover it can't run after clicking "Group".
    sendMessage<boolean>({ action: 'isAiReady' })
      .then((ready) => setAiReady(!!ready))
      .catch(() => setAiReady(false));
  }, []);

  async function updateStats() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    setTabCount(tabs.length);
    setMemoryInfo(formatMemoryEstimate(tabs.length));
  }

  // OneTab style: collapse all tabs into a single list
  async function handleCollapseAll() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const toCollapse = tabs.filter((t) => !t.active && t.url);

    if (toCollapse.length === 0) return;

    // Save URLs to storage
    const saved = await chrome.storage.local.get('collapsedTabs');
    const existing = saved.collapsedTabs || [];
    const newEntries = toCollapse.map((t) => ({
      url: t.url,
      title: t.title,
      favIconUrl: t.favIconUrl,
      savedAt: Date.now(),
    }));

    await chrome.storage.local.set({
      collapsedTabs: [...newEntries, ...existing],
    });

    // Close all non-active tabs
    for (const tab of toCollapse) {
      if (tab.id) await chrome.tabs.remove(tab.id);
    }

    await updateStats();
    onRefresh();
  }

  // Restore all collapsed tabs
  async function handleRestoreAll() {
    const saved = await chrome.storage.local.get('collapsedTabs');
    const collapsed = saved.collapsedTabs || [];

    if (collapsed.length === 0) return;

    // Open all URLs
    const urls = collapsed.map((t: any) => t.url).filter(Boolean);
    if (urls.length > 0) {
      await chrome.tabs.create({ url: urls[0] });
      for (let i = 1; i < urls.length; i++) {
        await chrome.tabs.create({ url: urls[i] });
      }
    }

    // Clear saved tabs
    await chrome.storage.local.set({ collapsedTabs: [] });

    await updateStats();
    onRefresh();
  }

  // Hibernate all inactive tabs — delegated to the background's
  // HibernationManager so it respects the same exclusion rules (pinned,
  // audible, chrome://, hibernation timeout) and updates the same stats
  // counter as the alarm-driven auto-hibernate and the context menu action.
  async function handleHibernateAll() {
    await sendMessage({ action: 'hibernateAll' });
    await updateStats();
    onRefresh();
  }

  // Close all duplicates — delegated to the background's TabManager so the
  // "which tab to keep" heuristic and the totalDuplicatesClosed stat stay in
  // sync with the context menu / keyboard-shortcut / auto-close code paths.
  async function handleCloseDuplicates() {
    await sendMessage({ action: 'closeDuplicates' });
    await updateStats();
    onRefresh();
  }

  // Close tabs older than N days
  async function handleCloseOld(days: number) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    for (const tab of tabs) {
      if (!tab.active && tab.id && (tab.lastAccessed || 0) < cutoff) {
        try {
          await chrome.tabs.remove(tab.id);
        } catch {}
      }
    }

    await updateStats();
    onRefresh();
  }

  // Close all tabs to the right of active
  async function handleCloseRight() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const activeIdx = tabs.findIndex((t) => t.active);
    if (activeIdx === -1) return;

    for (let i = activeIdx + 1; i < tabs.length; i++) {
      const tabId = tabs[i].id;
      if (tabId != null) await chrome.tabs.remove(tabId);
    }

    await updateStats();
    onRefresh();
  }

  async function handleConfirm(action: string) {
    setShowConfirm(null);
    switch (action) {
      case 'collapse':
        await handleCollapseAll();
        break;
      case 'hibernate':
        await handleHibernateAll();
        break;
      case 'duplicates':
        await handleCloseDuplicates();
        break;
      case 'old7':
        await handleCloseOld(7);
        break;
      case 'old30':
        await handleCloseOld(30);
        break;
    }
  }

  // Group tabs by a free-text instruction (e.g. "整体分为ai、工作、交流、开发、
  // 其他") instead of the built-in taxonomy — requires on-device AI, since
  // there's no way to map arbitrary category names onto keyword matching.
  //
  // Two-step: preview the AI's understanding of the instruction as a
  // category list first, so a misread instruction is caught before any
  // tab actually gets moved — only handleCustomConfirm below touches tabs.
  async function handleCustomPreview() {
    const instruction = customInstruction.trim();
    if (!instruction || customBusy) return;
    setCustomBusy(true);
    setCustomStatus('');
    try {
      const result = await sendMessage<string[] | { error: string }>({
        action: 'previewCustomCategories',
        instruction,
      });
      if (!Array.isArray(result)) throw new Error(result.error);
      setPreviewCategories(result);
    } catch (err: any) {
      setCustomStatus(describeCustomGroupError(err));
    }
    setCustomBusy(false);
  }

  async function handleCustomConfirm() {
    if (!previewCategories) return;
    setCustomBusy(true);
    const categories = previewCategories;
    setPreviewCategories(null);
    try {
      const instruction = customInstruction.trim();
      const result = await sendMessage<
        { grouped: number; categories: string[] } | { error: string }
      >({ action: 'smartGroupCustom', instruction, categories });
      if ('error' in result) throw new Error(result.error);
      setCustomStatus(`Grouped into: ${result.categories.join(', ')} (${result.grouped} tabs)`);
      await updateStats();
      onRefresh();
    } catch (err: any) {
      setCustomStatus(describeCustomGroupError(err));
    }
    setCustomBusy(false);
  }

  return (
    <div className="quick-actions">
      <div className="quick-stats">
        <div className="quick-stat">
          <span className="quick-stat-value">{tabCount}</span>
          <span className="quick-stat-label">Open Tabs</span>
        </div>
        <div className="quick-stat">
          <span className="quick-stat-value">{memoryInfo}</span>
          <span className="quick-stat-label">Est. Memory</span>
        </div>
      </div>

      {/* Custom-taxonomy grouping: group tabs by a free-text instruction
          instead of the built-in categories. Requires on-device AI. */}
      <div className="custom-group">
        <label className="custom-group-label">Group by your own instruction</label>
        {aiReady === false ? (
          <p className="custom-group-notice">
            On-device AI (Gemini Nano) isn't available right now — this feature needs it.
          </p>
        ) : (
          <>
            <div className="custom-group-row">
              <input
                type="text"
                className="custom-group-input"
                placeholder="e.g. 整体分为 AI、工作、交流、开发、其他"
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCustomPreview();
                }}
                disabled={customBusy || aiReady === null}
              />
              <button
                className="btn btn-primary"
                onClick={handleCustomPreview}
                disabled={customBusy || aiReady === null || !customInstruction.trim()}
              >
                {customBusy ? '⏳' : 'Group'}
              </button>
            </div>
            {customStatus && <p className="custom-group-status">{customStatus}</p>}
          </>
        )}
      </div>

      <div className="quick-grid">
        {/* One-click collapse (OneTab style) */}
        <button className="quick-btn primary" onClick={() => setShowConfirm('collapse')}>
          <span className="quick-btn-icon">📦</span>
          <span className="quick-btn-label">Collapse All</span>
          <span className="quick-btn-desc">Save & close inactive tabs</span>
        </button>

        {/* Restore collapsed */}
        <button className="quick-btn" onClick={handleRestoreAll}>
          <span className="quick-btn-icon">📤</span>
          <span className="quick-btn-label">Restore</span>
          <span className="quick-btn-desc">Reopen collapsed tabs</span>
        </button>

        {/* Hibernate */}
        <button className="quick-btn" onClick={() => setShowConfirm('hibernate')}>
          <span className="quick-btn-icon">💤</span>
          <span className="quick-btn-label">Hibernate</span>
          <span className="quick-btn-desc">Suspend inactive tabs</span>
        </button>

        {/* Close duplicates */}
        <button className="quick-btn" onClick={() => setShowConfirm('duplicates')}>
          <span className="quick-btn-icon">🔗</span>
          <span className="quick-btn-label">Dedup</span>
          <span className="quick-btn-desc">Close duplicate tabs</span>
        </button>

        {/* Close tabs to right */}
        <button className="quick-btn" onClick={handleCloseRight}>
          <span className="quick-btn-icon">➡️</span>
          <span className="quick-btn-label">Close Right</span>
          <span className="quick-btn-desc">Close tabs to the right</span>
        </button>

        {/* Close old tabs */}
        <button className="quick-btn" onClick={() => setShowConfirm('old7')}>
          <span className="quick-btn-icon">🗑️</span>
          <span className="quick-btn-label">Close Old</span>
          <span className="quick-btn-desc">Close tabs older than 7 days</span>
        </button>
      </div>

      {/* Confirm dialog for destructive quick actions */}
      {showConfirm && (
        <div className="confirm-overlay" onClick={() => setShowConfirm(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>{getConfirmMessage(showConfirm)}</p>
            <div className="confirm-actions">
              <button className="btn btn-primary" onClick={() => handleConfirm(showConfirm)}>
                Confirm
              </button>
              <button className="btn btn-secondary" onClick={() => setShowConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview dialog for custom-taxonomy grouping: shows what the AI
          understood BEFORE any tab actually gets moved. */}
      {previewCategories && (
        <div className="confirm-overlay" onClick={() => setPreviewCategories(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>Group tabs into these categories?</p>
            <div className="custom-group-chips">
              {previewCategories.map((c) => (
                <span key={c} className="custom-group-chip">
                  {c}
                </span>
              ))}
            </div>
            <div className="confirm-actions">
              <button className="btn btn-primary" onClick={handleCustomConfirm}>
                Confirm
              </button>
              <button className="btn btn-secondary" onClick={() => setPreviewCategories(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getConfirmMessage(action: string): string {
  switch (action) {
    case 'collapse':
      return "Collapse all inactive tabs? They'll be saved and can be restored later.";
    case 'hibernate':
      return 'Hibernate all inactive tabs? This frees up memory.';
    case 'duplicates':
      return 'Close all duplicate tabs?';
    case 'old7':
      return 'Close tabs not accessed in the last 7 days?';
    case 'old30':
      return 'Close tabs not accessed in the last 30 days?';
    default:
      return 'Are you sure?';
  }
}

function describeCustomGroupError(err: any): string {
  return err?.message === 'AI_UNAVAILABLE'
    ? "This needs on-device AI (Gemini Nano), which isn't available right now."
    : 'Could not understand that instruction — try rephrasing.';
}
