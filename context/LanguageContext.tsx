"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Locale = "en" | "bn";

interface Translations {
  [key: string]: string;
}

const LanguageContext = createContext<{
  locale: Locale;
  setLocale: (lang: Locale) => void;
  t: (key: string) => string;
}>({
  locale: "en",
  setLocale: () => {},
  t: (key: string) => key,
});

export const LanguageProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [locale, setLocale] = useState<Locale>("en");
  const [translations, setTranslations] = useState<Translations>({});

  // Load from localStorage and fetch translations
  useEffect(() => {
    const saved = localStorage.getItem("lang") as Locale;
    const initialLang = saved === "bn" || saved === "en" ? saved : "en";
    setLocale(initialLang);
  }, []);

  useEffect(() => {
    const loadTranslations = async () => {
      const res = await fetch(`/locales/${locale}/common.json`);
      const data = await res.json();
      setTranslations(data);
    };
    loadTranslations();
  }, [locale]);

  const changeLocale = (lang: Locale) => {
    localStorage.setItem("lang", lang);
    setLocale(lang);
  };

  const t = (key: string) => {
    return translations[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale: changeLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
