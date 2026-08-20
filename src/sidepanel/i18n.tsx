// TabCraft — React binding for the shared i18n dictionary.
//
// The dictionary and the pure translate() lookup live in shared/i18n.ts so the
// service worker can localize the in-page proxy badge without pulling React
// into the MV3 bundle. This file adds only the React layer: a context holding
// the active locale and a useT() hook. Switching the locale re-renders all
// consumers (no page reload), because the provider value changes. The active
// locale is persisted in Settings.language so it survives restarts.

import React, { createContext, useContext } from 'react';
import { translate, type Locale, type MessageKey } from '../shared/i18n';

export { translate, type Locale, type MessageKey };

const LocaleContext = createContext<Locale>('en');

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Hook returning a bound t(key, vars) for the active locale. */
export function useT() {
  const locale = useContext(LocaleContext);
  return (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
}
