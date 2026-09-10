"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, File, Shield, Zap, HardDrive } from "lucide-react";

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function DropZone({ onFilesSelected, disabled = false }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      onFilesSelected(filesArray);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      onFilesSelected(filesArray);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
      className={`relative group cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-200 ${
        isDragOver
          ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[1.01]"
          : "border-slate-300 dark:border-zinc-700/80 hover:border-slate-400 dark:hover:border-zinc-600 bg-slate-50/50 dark:bg-zinc-900/30 hover:bg-slate-50 dark:hover:bg-zinc-900/60"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
          <UploadCloud className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">
            Drop files here, or <span className="text-indigo-600 dark:text-indigo-400 underline decoration-indigo-300 underline-offset-4">browse</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Select videos, archives, photos, or documents of any size.
          </p>
        </div>

        {/* Value badges */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-xs">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            No Size Limit
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-xs">
            <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
            Zero Cloud Storage
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-xs">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            P2P Direct E2EE
          </span>
        </div>
      </div>
    </div>
  );
}
