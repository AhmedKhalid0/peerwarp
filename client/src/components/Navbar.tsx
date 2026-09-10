"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Sun, Moon, Github, ShieldCheck } from "lucide-react";

export function Navbar() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("peerwarp_theme") as "light" | "dark" | null;
    const initial = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    if (initial === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("peerwarp_theme", next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-black/90 backdrop-blur-md transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand with W + Upload Icon Logo */}
        <Link href="/" className="group flex items-center">
          <Logo size={20} showText={true} />
        </Link>

        {/* Center Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-600 dark:text-neutral-400">
          <a
            href="#how-it-works"
            className="hover:text-black dark:hover:text-white transition-colors"
          >
            How It Works
          </a>
          <a
            href="#why-peerwarp"
            className="hover:text-black dark:hover:text-white transition-colors"
          >
            Why PeerWarp
          </a>
          <a
            href="#faq"
            className="hover:text-black dark:hover:text-white transition-colors"
          >
            FAQ
          </a>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Privacy badge */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
            <ShieldCheck className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
            <span>End-to-End Encrypted</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800 transition-all"
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* GitHub Repo */}
          <a
            href="https://github.com/AhmedKhalid0/peerwarp"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:text-black dark:hover:text-white bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 transition-all"
          >
            <Github className="w-4 h-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
}
