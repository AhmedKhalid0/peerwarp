"use client";

import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

/**
 * PeerWarp Custom Brand Logo:
 * An elegant geometric fusion of the letter "W" (Warp)
 * and an upward "Upload/Transfer" arrow.
 */
export function Logo({ className = "", size = 24, showText = false }: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div
        className="flex items-center justify-center rounded-xl bg-black dark:bg-white text-white dark:text-black shadow-xs transition-transform group-hover:scale-105"
        style={{ width: size + 14, height: size + 14 }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-200"
        >
          {/* Outer 'W' stems & valleys */}
          <path d="M3.5 7.5 L7.5 19 L12 12.5 L16.5 19 L20.5 7.5" />
          {/* Central Upward Upload Arrow emerging from the center vertex */}
          <path d="M12 12.5 V3.5" />
          <path d="M8.5 7 L12 3.5 L15.5 7" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-lg tracking-tight text-neutral-900 dark:text-neutral-100">
              PeerWarp
            </span>
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
              P2P
            </span>
          </div>
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 -mt-0.5">
            Direct File Streaming
          </span>
        </div>
      )}
    </div>
  );
}

export default Logo;
