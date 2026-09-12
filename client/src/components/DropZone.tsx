"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, FolderUp, File, Shield, Zap, HardDrive } from "lucide-react";

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

        <div className="space-y-2">
          <h3 className="text-lg sm:text-xl font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Drop files or entire folders here
          </h3>
          <div className="flex items-center justify-center gap-3 text-sm">
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="font-medium text-black dark:text-white hover:underline underline-offset-4 cursor-pointer"
            >
              Browse Files
            </button>
            <span className="text-neutral-400 dark:text-neutral-600">•</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => folderInputRef.current?.click()}
              className="inline-flex items-center gap-1 font-medium text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:underline underline-offset-4 cursor-pointer"
            >
              <FolderUp className="w-3.5 h-3.5" />
              Select Folder
            </button>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Supports 4K videos, raw archives, or folder trees up to 5 GB per file.
          </p>
        </div>

        {/* Value badges */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xs">
            <Zap className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
            Up to 5 GB / File
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xs">
            <HardDrive className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
            Zero Cloud Storage
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xs">
            <Shield className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
            E2E Encrypted
          </span>
        </div>
      </div>
    </div>
  );
}
