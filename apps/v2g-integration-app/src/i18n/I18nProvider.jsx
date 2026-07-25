import { createContext, useContext, useMemo, useState } from "react";

import en from "./en.js";
import zhTw from "./zh-TW.js";

const storageKey = "v2g-scada-locale";
const supportedLocales = new Set(["zh-TW", "en"]);
const messages = { "zh-TW": zhTw, en };

export const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    const stored = window.localStorage.getItem(storageKey);
    return supportedLocales.has(stored) ? stored : "zh-TW";
  });

  const value = useMemo(() => {
    const setLocale = (next) => {
      if (!supportedLocales.has(next)) return;
      window.localStorage.setItem(storageKey, next);
      setLocaleState(next);
    };
    const t = (key, values = {}) => (messages[locale][key] ?? key)
      .replace(/\{(\w+)\}/g, (_, token) => String(values[token] ?? `{${token}}`));

    return { locale, setLocale, t };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (value) return value;
  return {
    locale: "en",
    setLocale: () => {},
    t: (key, values = {}) => (en[key] ?? key)
      .replace(/\{(\w+)\}/g, (_, token) => String(values[token] ?? `{${token}}`)),
  };
}
