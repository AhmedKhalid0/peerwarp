"use client";

import React, { useEffect } from "react";

interface AdSlotProps {
  slotId?: string;
  format?: "auto" | "rectangle" | "horizontal";
  className?: string;
}

export function AdSlot({ slotId = "peerwarp_responsive_banner", format = "auto", className = "" }: AdSlotProps) {
  useEffect(() => {
    // In production with Google AdSense script loaded, trigger push
    try {
      if (typeof window !== "undefined" && (window as any).adsbygoogle) {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      }
    } catch (err) {
      // Ignored in development without AdSense tag
    }
  }, []);

  return (
    <div className={`w-full my-6 flex flex-col items-center justify-center ${className}`}>
      {/* Container with subtle 1px border and neutral styling */}
      <div className="w-full max-w-2xl py-3 px-4 rounded-xl border border-slate-200/60 dark:border-zinc-800/60 bg-slate-50/50 dark:bg-zinc-900/30 text-center transition-colors">
        <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5 px-1">
          <span>Advertisement / Sponsor</span>
          <span>Zero-Storage Supported</span>
        </div>

        {/* Ad display area */}
        <div className="h-20 sm:h-24 w-full flex items-center justify-center rounded-lg bg-slate-100/70 dark:bg-zinc-800/40 border border-dashed border-slate-300/80 dark:border-zinc-700/60 text-xs text-slate-500 dark:text-zinc-400">
          <div className="space-y-0.5">
            <p className="font-medium text-slate-700 dark:text-zinc-300">
              ⚡ Support 100% Free, Unlimited P2P Streaming
            </p>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500">
              Replace this slot with your Google AdSense tag to monetize peer sessions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
