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
    <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-zinc-100">
                PeerWarp
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                100% Free
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 hidden sm:block">
              Zero-Cloud-Storage P2P Direct Streaming
            </p>
          </div>
        </Link>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Privacy badge */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-slate-200/60 dark:border-zinc-800">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>End-to-End Encrypted</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-900 border border-transparent hover:border-slate-200 dark:hover:border-zinc-800 transition-all"
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* GitHub Repo */}
          <a
            href="https://github.com/AhmedKhalid0/peerwarp"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200/70 dark:hover:bg-zinc-800 px-3 py-2 rounded-lg border border-slate-200/80 dark:border-zinc-800 transition-all"
          >
            <Github className="w-4 h-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
}
