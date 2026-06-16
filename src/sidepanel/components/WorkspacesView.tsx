// TabCraft — Workspaces View

import React, { useState, useEffect } from 'react';
import type { Workspace } from '../../shared/types';

export function WorkspacesView() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');

  useEffect(() => {
    loadWorkspaces();
  }, []);

  async function loadWorkspaces() {
    const result = await chrome.storage.local.get('workspaces');
    setWorkspaces(result.workspaces || []);
  }

  async function handleSave() {
    if (!workspaceName.trim()) return;

    const tabs = await chrome.tabs.query({ currentWindow: true });
    const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });

    const workspace: Workspace = {
      id: `ws_${Date.now()}`,
      name: workspaceName.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tabs: tabs.map(t => ({
        url: t.url || '',
        title: t.title || '',
        pinned: t.pinned || false,
        groupIndex: groups.findIndex(g => g.id === t.groupId),
      })),
      groups: groups.map(g => ({
        name: g.title || '',
        color: g.color,
        collapsed: g.collapsed,
      })),
    };

    const updated = [...workspaces, workspace];
    await chrome.storage.local.set({ workspaces: updated });
    setWorkspaces(updated);
    setWorkspaceName('');
    setShowSave(false);
  }

  async function handleRestore(workspace: Workspace) {
    // Open all tabs from workspace in a new window
    const win = await chrome.windows.create({
      url: workspace.tabs.filter(t => t.url).map(t => t.url),
      focused: true,
    });

    // Wait for tabs to load, then apply grouping
    setTimeout(async () => {
      if (!win.id) return;
      const newTabs = await chrome.tabs.query({ windowId: win.id });

      // Create groups
      for (let i = 0; i < workspace.groups.length; i++) {
        const group = workspace.groups[i];
        const groupTabs = newTabs.filter((_, idx) => workspace.tabs[idx]?.groupIndex === i);
        if (groupTabs.length > 0) {
          const tabIds = groupTabs.map(t => t.id!).filter(Boolean);
          if (tabIds.length > 0) {
            try {
              const groupId = await chrome.tabs.group({ tabIds });
              await chrome.tabGroups.update(groupId, {
                title: group.name,
                color: group.color,
                collapsed: group.collapsed,
              });
            } catch (err) {
              console.debug('Group restore failed:', err);
            }
          }
        }
      }
    }, 1000);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this workspace?')) return;
    const updated = workspaces.filter(w => w.id !== id);
    await chrome.storage.local.set({ workspaces: updated });
    setWorkspaces(updated);
  }

  async function handleExport(workspace: Workspace) {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabcraft-workspace-${workspace.name.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="workspaces-view">
      {/* Save Current */}
      {showSave ? (
        <div className="add-rule-form">
          <input
            placeholder="Workspace name..."
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            className="search-input"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
          <button className="btn btn-secondary" onClick={() => setShowSave(false)}>Cancel</button>
        </div>
      ) : (
        <button className="btn btn-primary full-width" onClick={() => setShowSave(true)}>
          💾 Save Current Workspace
        </button>
      )}

      {/* Workspace List */}
      {workspaces.length === 0 ? (
        <div className="view-placeholder">
          <p>No saved workspaces yet.</p>
          <p className="text-muted">Save your current tabs to restore them later.</p>
        </div>
      ) : (
        <div className="workspace-list">
          {workspaces.sort((a, b) => b.updatedAt - a.updatedAt).map(ws => (
            <div key={ws.id} className="workspace-card">
              <div className="workspace-header">
                <div>
                  <h4>{ws.name}</h4>
                  <span className="workspace-meta">
                    {ws.tabs.length} tabs · {ws.groups.length} groups · {formatDate(ws.updatedAt)}
                  </span>
                </div>
              </div>
              <div className="workspace-preview">
                {ws.groups.map((g, i) => (
                  <span key={i} className="workspace-group-pill" style={{ borderColor: `var(--group-${g.color}, var(--accent))` }}>
                    {g.name || 'Unnamed'}
                  </span>
                ))}
              </div>
              <div className="workspace-actions">
                <button className="btn btn-primary" onClick={() => handleRestore(ws)}>🔄 Restore</button>
                <button className="btn btn-secondary" onClick={() => handleExport(ws)}>📥 Export</button>
                <button className="btn btn-danger" onClick={() => handleDelete(ws.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
