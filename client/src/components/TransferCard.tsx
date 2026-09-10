"use client";

import React from "react";
import { Download, CheckCircle2, AlertCircle, Loader2, Gauge, Clock, ShieldCheck, XCircle } from "lucide-react";
import { formatBytes, formatDuration } from "@/lib/crypto";
import { FileTransferItem } from "@/types/protocol";

interface TransferCardProps {
  item: FileTransferItem;
  isReceiver?: boolean;
  onDownload?: () => void;
  onCancel?: () => void;
}

export function TransferCard({ item, isReceiver = false, onDownload, onCancel }: TransferCardProps) {
  const isTransferring = item.status === "sending" || item.status === "receiving";
  const isVerifying = item.status === "verifying";
  const isCompleted = item.status === "completed";
  const isError = item.status === "error" || item.status === "cancelled";

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs space-y-4">
      {/* File Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 truncate">
              {item.name}
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">
              ({formatBytes(item.size)})
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1 text-xs">
            {isTransferring && (
              <span className="inline-flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />
                {isReceiver ? "Streaming to device..." : "Streaming directly to peer..."}
              </span>
            )}
            {isVerifying && (
              <span className="inline-flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />
                Verifying SHA-256 integrity...
              </span>
            )}
            {isCompleted && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Transfer Complete & Verified
              </span>
            )}
            {isError && (
              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {item.error || "Transfer interrupted"}
              </span>
            )}
          </div>
        </div>

        {/* Action button */}
        {isCompleted && isReceiver && item.blobUrl && (
          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            Save File
          </button>
        )}

        {isTransferring && onCancel && (
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
            title="Cancel Transfer"
          >
            <XCircle className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-150 rounded-full ${
              isCompleted
                ? "bg-emerald-500"
                : isError
                ? "bg-rose-500"
                : "bg-zinc-900 dark:bg-zinc-100"
            }`}
            style={{ width: `${item.progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
          <span>{item.progress}%</span>
          <span>{formatBytes((item.size * item.progress) / 100)} of {formatBytes(item.size)}</span>
        </div>
      </div>

      {/* Realtime Speed, ETA & Hash Stats */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        {/* Speed */}
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <Gauge className="w-4 h-4 text-zinc-500 shrink-0" />
          <div>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Speed</p>
            <p className="font-semibold font-mono text-zinc-800 dark:text-zinc-200">
              {isTransferring ? `${formatBytes(item.speedBps)}/s` : isCompleted ? "Finished" : "--"}
            </p>
          </div>
        </div>

        {/* ETA */}
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
          <div>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Time Left</p>
            <p className="font-semibold font-mono text-zinc-800 dark:text-zinc-200">
              {isTransferring ? formatDuration(item.etaSeconds) : isCompleted ? "0s" : "--"}
            </p>
          </div>
        </div>

        {/* Cryptographic SHA-256 Hash */}
        <div className="col-span-2 sm:col-span-1 flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-zinc-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">SHA-256 Checksum</p>
            <p className="font-mono text-[11px] truncate text-zinc-800 dark:text-zinc-200" title={item.sha256}>
              {item.sha256 ? `${item.sha256.substring(0, 12)}...` : "Calculating..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
