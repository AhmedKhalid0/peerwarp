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
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">
            Selected Files ({files.length})
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            • {formatBytes(totalBytes)} total
          </span>
        </div>

        {!disabled && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Items List */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-60 overflow-y-auto">
        {files.map((file, idx) => (
          <div
            key={`${file.name}-${idx}`}
            className="px-5 py-3 flex items-center justify-between hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors text-xs sm:text-sm"
          >
            <div className="flex items-center gap-3 min-w-0 pr-4">
              <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-zinc-200/60 dark:border-zinc-700/60">
                {getFileIcon(file.name, file.type)}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {file.name}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                  {formatBytes(file.size)}
                </p>
              </div>
            </div>

            {!disabled && (
              <button
                onClick={() => onRemoveFile(idx)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all shrink-0"
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
