// TabCraft — Settings View

import React, { useState, useEffect } from 'react';
import type { ProxyBadgePosition, Settings } from '../../shared/types';
import {
  DEFAULT_SETTINGS,
  HIBERNATION_PRESETS,
  MIN_TABS_PRESETS,
  PROXY_DEFAULT_API_URL,
} from '../../shared/constants';
import { describeApiState, type ProxyApiState } from '../../shared/proxy';
import { useT } from '../i18n';
import { sendMessage } from '../utils';

export function SettingsView() {
  const t = useT();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [learnedCount, setLearnedCount] = useState(0);
  const [proxyUrlDraft, setProxyUrlDraft] = useState(DEFAULT_SETTINGS.proxyApiUrl);
  const [proxySecretDraft, setProxySecretDraft] = useState(DEFAULT_SETTINGS.proxyApiSecret);
  const [proxyStatus, setProxyStatus] = useState<string | null>(null);
  const [proxyTesting, setProxyTesting] = useState(false);

  useEffect(() => {
    chrome.storage.local.get('settings', (result) => {
      // Merge over defaults: a settings object written by an older version is
      // missing every key added since, and an undefined value would blank the
      // input it's bound to.
      const stored: Settings = { ...DEFAULT_SETTINGS, ...(result.settings ?? {}) };
      setSettings(stored);
      setProxyUrlDraft(stored.proxyApiUrl);
      setProxySecretDraft(stored.proxyApiSecret);
    });
    refreshLearnedCount();
  }, []);

  function refreshLearnedCount() {
    sendMessage<number>({ action: 'learnedCount' })
      .then((n) => setLearnedCount(typeof n === 'number' ? n : 0))
      .catch(() => {});
  }

  async function handleClearLearned() {
    if (learnedCount === 0) return;
    if (!confirm(`Forget all ${learnedCount} learned domain mappings?`)) return;
    await sendMessage({ action: 'clearLearned' }).catch(() => {});
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
    if (confirm("Reset all settings to defaults? This won't delete your rules or workspaces.")) {
      await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
      setSettings(DEFAULT_SETTINGS);
    }
  }

  /** The badge is the extension's only feature that touches page DOM, so it is
   *  also the only one needing a host permission. TabCraft ships with none:
   *  <all_urls> is declared optional and requested here, at opt-in. Declining
   *  leaves the setting off rather than half-enabled. */
  async function handleProxyBadgeToggle(enabled: boolean) {
    setProxyStatus(null);
    if (enabled) {
      const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
      if (!granted) {
        setProxyStatus(t('proxyBadgeDenied'));
        return;
      }
    } else {
      // Hand the permission back when the feature goes off — nothing else uses it.
      await chrome.permissions.remove({ origins: ['<all_urls>'] }).catch(() => {});
    }
    update('showProxyBadge', enabled);
  }

  async function handleProxyTest() {
    setProxyTesting(true);
    setProxyStatus(null);
    const result = await sendMessage<{ state: ProxyApiState; version?: string }>({
      action: 'proxyProbe',
    }).catch(() => null);
    setProxyTesting(false);
    setProxyStatus(
      !result
        ? describeApiState('unreachable', settings.language).text
        : result.state === 'ok'
          ? t('proxyTestOk', { version: result.version ?? '?' })
          : describeApiState(result.state, settings.language).text
    );
  }

  return (
    <div className="settings-view">
      <div className="settings-section">
        <h3>{t('settingsTitle')}</h3>

        <div className="setting-row">
          <div className="setting-label">
            <span>{t('language')}</span>
            <span className="setting-desc">{t('languageDesc')}</span>
          </div>
          <select
            className="setting-select"
            value={settings.language}
            onChange={(e) => update('language', e.target.value as Settings['language'])}
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </div>
      </div>

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
            {MIN_TABS_PRESETS.map((n) => (
              <option key={n} value={n}>
                {n} tabs
              </option>
            ))}
          </select>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>{t('learnFromActivity')}</span>
            <span className="setting-desc">{t('learnFromActivityDesc')}</span>
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
              <span>{t('learnedMappings')}</span>
              <span className="setting-desc">{t('learnedRemembered', { n: learnedCount })}</span>
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleClearLearned}
              disabled={learnedCount === 0}
              title="Forget all learned domain→group mappings"
            >
              {t('clear')}
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
            {HIBERNATION_PRESETS.map((min) => (
              <option key={min} value={min}>
                {min} min
              </option>
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
        <h3>{t('proxySection')}</h3>

        <div className="setting-row">
          <div className="setting-label">
            <span>{t('proxyBadge')}</span>
            <span className="setting-desc">{t('proxyBadgeDesc')}</span>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.showProxyBadge}
              onChange={(e) => handleProxyBadgeToggle(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>{t('proxyApiUrl')}</span>
            <span className="setting-desc">{t('proxyApiUrlDesc')}</span>
          </div>
          <input
            className="setting-input"
            type="text"
            spellCheck={false}
            placeholder={PROXY_DEFAULT_API_URL}
            value={proxyUrlDraft}
            onChange={(e) => setProxyUrlDraft(e.target.value)}
            onBlur={() => update('proxyApiUrl', proxyUrlDraft.trim())}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>{t('proxyApiSecret')}</span>
            <span className="setting-desc">{t('proxyApiSecretDesc')}</span>
          </div>
          <input
            className="setting-input"
            type="password"
            autoComplete="off"
            value={proxySecretDraft}
            onChange={(e) => setProxySecretDraft(e.target.value)}
            onBlur={() => update('proxyApiSecret', proxySecretDraft)}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>{t('proxyPosition')}</span>
            <span className="setting-desc">{t('proxyPositionDesc')}</span>
          </div>
          <select
            className="setting-select"
            value={settings.proxyBadgePosition}
            onChange={(e) => update('proxyBadgePosition', e.target.value as ProxyBadgePosition)}
          >
            <option value="top-left">{t('proxyPosTopLeft')}</option>
            <option value="top-right">{t('proxyPosTopRight')}</option>
            <option value="bottom-left">{t('proxyPosBottomLeft')}</option>
            <option value="bottom-right">{t('proxyPosBottomRight')}</option>
          </select>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>{t('proxyStatusLabel')}</span>
            {proxyStatus && <span className="setting-desc">{proxyStatus}</span>}
          </div>
          <button className="btn btn-secondary" onClick={handleProxyTest} disabled={proxyTesting}>
            {proxyTesting ? t('proxyTesting') : t('proxyTest')}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Data</h3>
        <div className="settings-actions">
          <button className="btn btn-secondary" onClick={handleExport}>
            📥 Export Settings
          </button>
          <button className="btn btn-secondary" onClick={handleImport}>
            📤 Import Settings
          </button>
          <button className="btn btn-danger" onClick={handleReset}>
            🔄 Reset to Defaults
          </button>
        </div>
      </div>

      {saved && <div className="toast success">✓ Saved</div>}
    </div>
  );
}
