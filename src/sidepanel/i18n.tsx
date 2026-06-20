// TabCraft — Lightweight in-app i18n
//
// A tiny translation layer: a string dictionary keyed by message id, a React
// context holding the active locale, and a useT() hook returning a t(key)
// function. Switching the locale re-renders all consumers (no page reload),
// because the provider value changes. The active locale is persisted in
// Settings.language so it survives restarts.

import React, { createContext, useContext } from 'react';

export type Locale = 'en' | 'zh';

/** Message dictionary. Add keys here; every locale must define each key. */
const MESSAGES = {
  en: {
    // header / actions
    smartGroup: 'Smart Group',
    dedup: 'Dedup',
    undo: 'Undo',
    hibernate: 'Hibernate',
    aiActive: '✨ AI',
    rulesActive: '📐 Rules',
    // nav
    navTabs: 'Tabs',
    navTree: 'Tree',
    navDedup: 'Dedup',
    navRules: 'Rules',
    navSettings: 'Settings',
    navWorkspaces: 'Workspaces',
    navStats: 'Stats',
    navQuick: 'Quick',
    // search
    searchPlaceholder: 'Search tabs…',
    // status
    grouped: 'Grouped {n} tabs into {g} groups',
    groupingUndone: 'Grouping undone',
    nothingToUndo: 'Nothing to undo',
    smartGroupFailed: 'Smart group failed',
    undoFailed: 'Undo failed',
    // settings
    settingsTitle: 'Settings',
    language: 'Language',
    languageDesc: 'Interface language',
    learnFromActivity: 'Learn from activity',
    learnFromActivityDesc: 'Remember your manual group adjustments',
    learnedMappings: 'Learned mappings',
    learnedRemembered: '{n} domains remembered',
    clear: 'Clear',
  },
  zh: {
    smartGroup: '智能分组',
    dedup: '去重',
    undo: '撤销',
    hibernate: '休眠',
    aiActive: '✨ AI',
    rulesActive: '📐 规则',
    navTabs: '标签页',
    navTree: '树状',
    navDedup: '去重',
    navRules: '规则',
    navSettings: '设置',
    navWorkspaces: '工作区',
    navStats: '统计',
    navQuick: '快捷',
    searchPlaceholder: '搜索标签页…',
    grouped: '已将 {n} 个标签页分到 {g} 个分组',
    groupingUndone: '已撤销分组',
    nothingToUndo: '没有可撤销的操作',
    smartGroupFailed: '智能分组失败',
    undoFailed: '撤销失败',
    settingsTitle: '设置',
    language: '语言',
    languageDesc: '界面语言',
    learnFromActivity: '从行为学习',
    learnFromActivityDesc: '记住你手动调整的分组',
    learnedMappings: '已学习映射',
    learnedRemembered: '已记住 {n} 个域名',
    clear: '清除',
  },
} as const;

export type MessageKey = keyof (typeof MESSAGES)['en'];

/** Translate a key for a locale, with optional {placeholder} substitution. */
export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const table = MESSAGES[locale] ?? MESSAGES.en;
  let str: string = table[key] ?? MESSAGES.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}

const LocaleContext = createContext<Locale>('en');

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Hook returning a bound t(key, vars) for the active locale. */
export function useT() {
  const locale = useContext(LocaleContext);
  return (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
}
