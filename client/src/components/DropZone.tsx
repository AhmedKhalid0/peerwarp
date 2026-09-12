"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, FolderUp, File, Shield, Zap, HardDrive, Wifi, Smartphone } from "lucide-react";

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function DropZone({ onFilesSelected, disabled = false }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // Recursively traverse FileSystemEntry objects for dropped folders
  const traverseDirectory = async (entry: any, path = ""): Promise<File[]> => {
    const files: File[] = [];
    if (entry.isFile) {
      const file: File = await new Promise((resolve, reject) => entry.file(resolve, reject));
      const relativePath = path ? `${path}/${file.name}` : file.name;
      Object.defineProperty(file, "relativePath", {
        value: relativePath,
        writable: true,
      });
      files.push(file);
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const readAllEntries = async (): Promise<any[]> => {
        const entries: any[] = [];
        let batch: any[] = [];
        do {
          batch = await new Promise<any[]>((resolve, reject) => {
            dirReader.readEntries(resolve, reject);
          });
          entries.push(...batch);
        } while (batch.length > 0);
        return entries;
      };

      const children = await readAllEntries();
      for (const child of children) {
        const nested = await traverseDirectory(child, path ? `${path}/${entry.name}` : entry.name);
        files.push(...nested);
      }
    }
    return files;
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const entriesToScan: any[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (typeof item.webkitGetAsEntry === "function") {
          const entry = item.webkitGetAsEntry();
          if (entry) entriesToScan.push(entry);
        }
      }

      if (entriesToScan.length > 0) {
        const gatheredFiles: File[] = [];
        for (const entry of entriesToScan) {
          const res = await traverseDirectory(entry);
          gatheredFiles.push(...res);
        }
        if (gatheredFiles.length > 0) {
          onFilesSelected(gatheredFiles);
          return;
        }
      }
    }

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

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      for (const file of filesArray) {
        if (file.webkitRelativePath) {
          Object.defineProperty(file, "relativePath", {
            value: file.webkitRelativePath,
            writable: true,
          });
        }
      }
      onFilesSelected(filesArray);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative group rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-200 ${
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
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFolderChange}
        className="hidden"
        disabled={disabled}
      />

      <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white border border-neutral-200 dark:border-neutral-700 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
          <UploadCloud className="w-7 h-7" />
        </div>

        <div className="space-y-3 w-full">
          <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Drop files or entire folders here
          </h3>

          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
            Drag & drop anything from your desktop, or click below to select
          </p>

          {/* Prominent Large Browse Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-3 w-full max-w-lg mx-auto">
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-3 px-8 py-4 sm:px-9 sm:py-4.5 rounded-2xl bg-neutral-900 hover:bg-black text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-950 font-extrabold text-base sm:text-lg shadow-md hover:shadow-lg transition-all scale-100 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <UploadCloud className="w-6 h-6 shrink-0" />
              <span>Browse Files</span>
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() => folderInputRef.current?.click()}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-3 px-8 py-4 sm:px-9 sm:py-4.5 rounded-2xl border-2 border-neutral-300 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-extrabold text-base sm:text-lg shadow-sm hover:shadow-md transition-all scale-100 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <FolderUp className="w-6 h-6 shrink-0 text-neutral-700 dark:text-neutral-300" />
              <span>Browse Folders</span>
            </button>
          </div>
        </div>

        {/* Value badges */}
        <div className="pt-3 flex flex-wrap items-center justify-center gap-2.5 text-xs text-neutral-600 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xs font-semibold text-neutral-900 dark:text-neutral-100">
            <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Up to 50 GB on Wi-Fi
          </span>
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xs font-semibold">
            <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Up to 5 GB on Mobile / 4G
          </span>
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xs font-semibold">
            <HardDrive className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
            Zero Cloud Storage
          </span>
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xs font-semibold">
            <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            End-to-End Encrypted
          </span>
        </div>
      </div>
    </div>
  );
}
