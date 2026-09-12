"use client";

import React from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-800 py-8 bg-neutral-50 dark:bg-neutral-950 text-xs text-neutral-500 dark:text-neutral-400">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-3">
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">PeerWarp</span>
          <span>•</span>
          <Link
            href="/privacy"
            className="hover:text-neutral-900 dark:hover:text-neutral-100 hover:underline transition-colors"
          >
            {t("footer_privacy")}
          </Link>
          <span>•</span>
          <Link
            href="/terms"
            className="hover:text-neutral-900 dark:hover:text-neutral-100 hover:underline transition-colors"
          >
            {t("footer_terms")}
          </Link>
          <span>•</span>
          <span>{t("footer_license")}</span>
        </div>

        <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
          <span>{t("footer_engineered_by")}</span>
          <a
            href="https://ahmedalgendy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-black dark:text-white hover:underline"
          >
            Ahmed Algendy
          </a>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4 text-center md:text-start text-[11px] text-neutral-400 dark:text-neutral-600 leading-relaxed">
        {t("footer_disclaimer_text")}
      </div>
    </footer>
  );
}
