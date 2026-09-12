"use client";

import React from "react";
import { File, FileText, Film, Music, Archive, X, Trash2 } from "lucide-react";
import { formatBytes } from "@/lib/crypto";

interface FileQueueProps {
  files: File[];
  onRemoveFile: (index: number) => void;
  onClearAll: () => void;
  disabled?: boolean;
}

function getFileIcon(fileName: string, type: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) {
    return <File className="w-4.5 h-4.5 text-zinc-600 dark:text-zinc-300" />;
  }
  if (type.startsWith("video/") || ["mp4", "mkv", "avi", "mov", "webm"].includes(ext)) {
    return <Film className="w-4.5 h-4.5 text-zinc-700 dark:text-zinc-200" />;
  }
  if (type.startsWith("audio/") || ["mp3", "wav", "flac", "m4a", "ogg"].includes(ext)) {
    return <Music className="w-4.5 h-4.5 text-zinc-600 dark:text-zinc-300" />;
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return <Archive className="w-4.5 h-4.5 text-zinc-700 dark:text-zinc-200" />;
  }
  return <FileText className="w-4.5 h-4.5 text-zinc-500 dark:text-zinc-400" />;
}

export function FileQueue({ files, onRemoveFile, onClearAll, disabled = false }: FileQueueProps) {
  if (files.length === 0) return null;

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100">
            Selected Files ({files.length})
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
            • {formatBytes(totalBytes)} total
          </span>
        </div>

        {!disabled && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Items List */}
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60 max-h-60 overflow-y-auto">
        {files.map((file, idx) => (
          <div
            key={`${file.name}-${idx}`}
            className="px-5 py-3 flex items-center justify-between hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors text-xs sm:text-sm"
          >
            <div className="flex items-center gap-3 min-w-0 pr-4">
              <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-neutral-200/60 dark:border-neutral-700/60">
                {getFileIcon(file.name, file.type)}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {(file as any).relativePath || file.name}
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                  {formatBytes(file.size)}
                </p>
              </div>
            </div>

            {!disabled && (
              <button
                onClick={() => onRemoveFile(idx)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
