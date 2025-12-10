"use client";

import { useTranslation } from "@/context/LanguageContext";
import { useState } from "react";
import { FaChevronDown } from "react-icons/fa6";

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleChange = (lang: "en" | "bn") => {
    setLocale(lang);
    setOpen(false);
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center w-full px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none"
      >
        {locale === "en" ? "🇺🇸 English" : "🇧🇩 বাংলা"}
        <FaChevronDown className="ml-2 h-3 w-3 text-gray-500" />
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 transition-all duration-150 ease-in-out">
          <div className="py-1">
            <button
              onClick={() => handleChange("en")}
              className={`${
                locale === "en" ? "bg-gray-100" : ""
              } block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100`}
            >
              🇺🇸 English
            </button>
            <button
              onClick={() => handleChange("bn")}
              className={`${
                locale === "bn" ? "bg-gray-100" : ""
              } block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100`}
            >
              🇧🇩 বাংলা
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
