// TabCraft — Settings View

import React, { useState, useEffect } from 'react';
import type { Settings } from '../../shared/types';
import { DEFAULT_SETTINGS, HIBERNATION_PRESETS, MIN_TABS_PRESETS } from '../../shared/constants';

export function SettingsView() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [learnedCount, setLearnedCount] = useState(0);

  useEffect(() => {
    chrome.storage.local.get('settings', (result) => {
      if (result.settings) setSettings(result.settings);
    });
    refreshLearnedCount();
  }, []);

  function refreshLearnedCount() {
    chrome.runtime.sendMessage({ action: 'learnedCount' })
      .then((n) => setLearnedCount(typeof n === 'number' ? n : 0))
      .catch(() => {});
  }

  async function handleClearLearned() {
    if (learnedCount === 0) return;
    if (!confirm(`Forget all ${learnedCount} learned domain mappings?`)) return;
    await chrome.runtime.sendMessage({ action: 'clearLearned' }).catch(() => {});
    refreshLearnedCount();
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    chrome.storage.local.set({ settings: next });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function handleExport() {
    const data = await new Promise<any>((resolve) => {
      chrome.storage.local.get(null, resolve);
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabcraft-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        await chrome.storage.local.set(data);
        if (data.settings) setSettings(data.settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch {
        alert('Invalid backup file');
      }
    };
    input.click();
  }

  async function handleReset() {
    if (confirm('Reset all settings to defaults? This won\'t delete your rules or workspaces.')) {
      await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
      setSettings(DEFAULT_SETTINGS);
    }
  }

  return (
    <div className="settings-view">
      <div className="settings-section">
        <h3>Grouping</h3>

        <div className="setting-row">
          <div className="setting-label">
            <span>Auto-group new tabs</span>
            <span className="setting-desc">Automatically categorize tabs as you browse</span>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.autoGroup}
              onChange={(e) => update('autoGroup', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Grouping mode</span>
            <span className="setting-desc">Smart = AI topic, Domain = by website</span>
          </div>
          <select
            className="setting-select"
            value={settings.groupingMode}
            onChange={(e) => update('groupingMode', e.target.value as 'smart' | 'domain')}
          >
            <option value="smart">Smart (AI)</option>
            <option value="domain">Domain-based</option>
          </select>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>AI Provider</span>
            <span className="setting-desc">Gemini Nano runs locally, no data sent</span>
          </div>
          <select
            className="setting-select"
            value={settings.aiProvider}
            onChange={(e) => update('aiProvider', e.target.value as 'gemini-nano' | 'rule-engine')}
          >
            <option value="gemini-nano">Gemini Nano (on-device)</option>
            <option value="rule-engine">Rule Engine only</option>
          </select>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Min tabs per group</span>
            <span className="setting-desc">Groups won't be created below this count</span>
          </div>
          <select
            className="setting-select"
            value={settings.minTabsPerGroup}
            onChange={(e) => update('minTabsPerGroup', Number(e.target.value))}
          >
            {MIN_TABS_PRESETS.map(n => (
              <option key={n} value={n}>{n} tabs</option>
            ))}
          </select>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Learn from activity</span>
            <span className="setting-desc">Remember your manual group adjustments</span>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.learnFromActivity}
              onChange={(e) => update('learnFromActivity', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        {settings.learnFromActivity && (
          <div className="setting-row">
            <div className="setting-label">
              <span>Learned mappings</span>
              <span className="setting-desc">{learnedCount} domain{learnedCount === 1 ? '' : 's'} remembered</span>
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleClearLearned}
              disabled={learnedCount === 0}
              title="Forget all learned domain→group mappings"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>Duplicates</h3>

        <div className="setting-row">
          <div className="setting-label">
            <span>Auto-close duplicates</span>
            <span className="setting-desc">Close duplicate tabs as they appear</span>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.autoCloseDuplicates}
              onChange={(e) => update('autoCloseDuplicates', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Show duplicate badge</span>
            <span className="setting-desc">Show count on extension icon</span>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.showDuplicateBadge}
              onChange={(e) => update('showDuplicateBadge', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>Hibernation</h3>

        <div className="setting-row">
          <div className="setting-label">
            <span>Auto-hibernate after</span>
            <span className="setting-desc">Inactive tabs are suspended to save memory</span>
          </div>
          <select
            className="setting-select"
            value={settings.hibernationTimeout}
            onChange={(e) => update('hibernationTimeout', Number(e.target.value))}
          >
            {HIBERNATION_PRESETS.map(min => (
              <option key={min} value={min}>{min} min</option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h3>Appearance</h3>

        <div className="setting-row">
          <div className="setting-label">
            <span>Theme</span>
            <span className="setting-desc">Follows system by default</span>
          </div>
          <select
            className="setting-select"
            value={settings.theme}
            onChange={(e) => update('theme', e.target.value as 'system' | 'light' | 'dark')}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h3>Data</h3>
        <div className="settings-actions">
          <button className="btn btn-secondary" onClick={handleExport}>📥 Export Settings</button>
          <button className="btn btn-secondary" onClick={handleImport}>📤 Import Settings</button>
          <button className="btn btn-danger" onClick={handleReset}>🔄 Reset to Defaults</button>
        </div>
      </div>

      {saved && <div className="toast success">✓ Saved</div>}
    </div>
  );
}
