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
          ? "border-black dark:border-white bg-neutral-100/60 dark:bg-neutral-800/40 scale-[1.01]"
          : "border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50/70 dark:bg-neutral-900/40 hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
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
        <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white border border-neutral-200 dark:border-neutral-700 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
          <UploadCloud className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg sm:text-xl font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Drop files here, or <span className="text-black dark:text-white font-semibold underline decoration-neutral-400 underline-offset-4">browse files</span>
          </h3>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Select 4K videos, archives, raw photos, or folders of any size.
          </p>
        </div>

        {/* Value badges */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xs">
            <Zap className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
            No Size Limit
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xs">
            <HardDrive className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
            Zero Cloud Storage
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xs">
            <Shield className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
            Encrypted P2P
          </span>
        </div>
      </div>
    </div>
  );
}
