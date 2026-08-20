// TabCraft — Message dictionary and the pure translate() lookup.
//
// Kept chrome-free and React-free so all three consumers share one dictionary:
// the side panel (via the LocaleProvider/useT wrapper in sidepanel/i18n.tsx),
// the service worker (which localizes the in-page proxy badge payload before
// injecting it — the injected code is serialized and cannot import anything),
// and the unit tests.

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
    // proxy badge — settings
    proxySection: 'Proxy indicator',
    proxyBadge: 'Show proxy on every page',
    proxyBadgeDesc: 'A small pill naming the node this page actually egressed through',
    proxyBadgeDenied: 'Permission declined — the indicator stays off',
    proxyApiUrl: 'Controller API',
    proxyApiUrlDesc: 'Clash / mihomo external-controller address',
    proxyApiSecret: 'API secret',
    proxyApiSecretDesc: 'Leave empty if the controller has no secret',
    proxyPosition: 'Position',
    proxyPositionDesc: 'Which corner the pill sits in',
    proxyPosTopLeft: 'Top left',
    proxyPosTopRight: 'Top right',
    proxyPosBottomLeft: 'Bottom left',
    proxyPosBottomRight: 'Bottom right',
    proxyStatusLabel: 'Controller status',
    proxyTest: 'Test',
    proxyTesting: 'Testing…',
    proxyTestOk: 'Connected — mihomo {version}',
    // proxy badge — in-page strings
    proxyDirect: 'Direct',
    proxyBlocked: 'Blocked',
    proxyUnknown: 'No route seen yet',
    proxyUnconfigured: 'Controller API not set',
    proxyUnreachable: 'Controller unreachable',
    proxyUnauthorized: 'Controller rejected the secret',
    proxyVia: 'via {groups}',
    proxyRule: 'matched {rule}',
    proxyInferred: 'inferred from {host}',
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
    proxySection: '代理指示器',
    proxyBadge: '在每个网页显示当前代理',
    proxyBadgeDesc: '用小标签显示本页流量实际走的出口节点',
    proxyBadgeDenied: '未授权，指示器保持关闭',
    proxyApiUrl: '控制器 API',
    proxyApiUrlDesc: 'Clash / mihomo 的 external-controller 地址',
    proxyApiSecret: 'API 密钥',
    proxyApiSecretDesc: '控制器未设置 secret 时留空',
    proxyPosition: '显示位置',
    proxyPositionDesc: '标签停靠的角落',
    proxyPosTopLeft: '左上',
    proxyPosTopRight: '右上',
    proxyPosBottomLeft: '左下',
    proxyPosBottomRight: '右下',
    proxyStatusLabel: '控制器状态',
    proxyTest: '测试',
    proxyTesting: '测试中…',
    proxyTestOk: '已连接 — mihomo {version}',
    proxyDirect: '直连',
    proxyBlocked: '已拦截',
    proxyUnknown: '暂未观察到路由',
    proxyUnconfigured: '未配置控制器 API',
    proxyUnreachable: '控制器无法连接',
    proxyUnauthorized: '控制器拒绝了密钥',
    proxyVia: '经 {groups}',
    proxyRule: '命中 {rule}',
    proxyInferred: '据 {host} 推断',
  },
} as const;

export type MessageKey = keyof (typeof MESSAGES)['en'];

/** Translate a key for a locale, with optional {placeholder} substitution. */
export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>
): string {
  const table = MESSAGES[locale] ?? MESSAGES.en;
  let str: string = table[key] ?? MESSAGES.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}
