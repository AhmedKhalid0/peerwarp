"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, Sun, Moon, Github, ShieldCheck, Heart } from "lucide-react";

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
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-950 shadow-xs group-hover:scale-105 transition-transform">
            <Zap className="w-4.5 h-4.5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-100">
                PeerWarp
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                100% Free
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden sm:block">
              Zero-Cloud-Storage P2P Direct Streaming
            </p>
          </div>
        </Link>

        {/* Center Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          <a
            href="#how-it-works"
            className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            How It Works
          </a>
          <a
            href="#why-peerwarp"
            className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Why PeerWarp
          </a>
          <a
            href="#faq"
            className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            FAQ
          </a>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Privacy badge */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
            <ShieldCheck className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span>End-to-End Encrypted</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-all"
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* GitHub Repo */}
          <a
            href="https://github.com/AhmedKhalid0/peerwarp"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 px-3 py-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800 transition-all"
          >
            <Github className="w-4 h-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
}
