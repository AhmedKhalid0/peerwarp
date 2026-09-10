"use client";

import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, QrCode, Share2, Smartphone, ShieldCheck } from "lucide-react";

interface PairingModalProps {
  roomId: string;
  shareUrl: string;
  peerCount: number;
}

export function PairingModal({ roomId, shareUrl, peerCount }: PairingModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current && shareUrl) {
      QRCode.toCanvas(
        canvasRef.current,
        shareUrl,
        {
          width: 170,
          margin: 1,
          color: {
            dark: "#1e1b4b",
            light: "#ffffff",
          },
        },
        (error) => {
          if (error) console.error("QR Code generation error:", error);
        }
      );
    }
  }, [shareUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Left: Code & Instructions */}
        <div className="flex-1 space-y-5 text-center md:text-left">
          <div className="space-y-1">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {peerCount === 1 ? "Waiting for recipient to connect..." : "Recipient Connected"}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              Pair your devices
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
              Open this link or scan the QR code on the receiving phone, tablet, or laptop.
            </p>
          </div>

          {/* 6-Character Room Code Display */}
          <div className="inline-flex flex-col items-center md:items-start space-y-1.5">
            <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
              One-Time Room Code
            </span>
            <div className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700">
              <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-widest text-indigo-600 dark:text-indigo-400">
                {roomId}
              </span>
            </div>
          </div>

          {/* Copy Link Action */}
          <div className="flex items-center gap-2 max-w-md mx-auto md:mx-0">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 text-xs px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-mono select-all focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs transition-colors shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-4 text-[11px] text-slate-400 dark:text-zinc-500 pt-1">
            <span className="flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5" />
              Works on iOS & Android
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Zero Storage Logs
            </span>
          </div>
        </div>

        {/* Right: QR Code Box */}
        <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700/80 shadow-xs shrink-0">
          <div className="p-2 bg-white rounded-xl shadow-xs">
            <canvas ref={canvasRef} className="rounded-lg" />
          </div>
          <p className="mt-2.5 text-[11px] font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5" />
            Scan to receive on phone
          </p>
        </div>
      </div>
    </div>
  );
}
