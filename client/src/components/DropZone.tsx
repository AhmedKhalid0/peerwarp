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
          ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100/60 dark:bg-zinc-800/40 scale-[1.01]"
          : "border-zinc-300 dark:border-zinc-700/80 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/70 dark:bg-zinc-900/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
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
        <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
          <UploadCloud className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Drop files here, or <span className="text-zinc-900 dark:text-zinc-100 font-semibold underline decoration-zinc-400 dark:decoration-zinc-500 underline-offset-4">browse files</span>
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Select 4K videos, archives, raw photos, or folders of any size.
          </p>
        </div>

        {/* Value badges */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 shadow-xs">
            <Zap className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
            No Size Limit
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 shadow-xs">
            <HardDrive className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
            Zero Cloud Storage
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 shadow-xs">
            <Shield className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
            Encrypted P2P
          </span>
        </div>
      </div>
    </div>
  );
}
