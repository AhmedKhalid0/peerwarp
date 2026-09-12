"use client";

import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, QrCode, Share2, Smartphone, ShieldCheck } from "lucide-react";

interface PairingModalProps {
  roomId: string;
  shareUrl: string;
  peerCount: number;
  maxPeers?: number;
}

export function PairingModal({ roomId, shareUrl, peerCount, maxPeers = 5 }: PairingModalProps) {
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
            dark: "#18181b",
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

  const recipientCount = Math.max(0, peerCount - 1);

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 sm:p-8 shadow-xs">
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Left: Code & Instructions */}
        <div className="flex-1 space-y-5 text-center md:text-left">
          <div className="space-y-1">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className={`flex h-2 w-2 rounded-full ${recipientCount > 0 ? "bg-emerald-500" : "bg-neutral-400 animate-pulse"}`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                {recipientCount > 0
                  ? `${recipientCount} of ${maxPeers} Recipient${recipientCount > 1 ? "s" : ""} Connected`
                  : `Waiting for recipients (Up to ${maxPeers} allowed)...`}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Pair your devices
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              Scan this QR code with your phone camera, or send the direct link to your colleagues.
            </p>
          </div>

          {/* 6-Character Room Code Display */}
          <div className="inline-flex flex-col items-center md:items-start space-y-1.5">
            <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              One-Time Room Code
            </span>
            <div className="px-6 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-widest text-black dark:text-white">
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
              className="flex-1 text-xs px-3.5 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-mono select-all focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black font-medium text-xs shadow-xs transition-colors shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
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

          <div className="flex items-center justify-center md:justify-start gap-4 text-[11px] text-neutral-500 dark:text-neutral-400 pt-1">
            <span className="flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5" />
              iPhone, Android, Mac & Windows
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Zero Cloud Storage
            </span>
          </div>
        </div>

        {/* Right: QR Code Box */}
        <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 shadow-xs shrink-0">
          <div className="p-2 bg-white rounded-xl shadow-xs border border-neutral-100">
            <canvas ref={canvasRef} className="rounded-lg" />
          </div>
          <p className="mt-2.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5" />
            Scan to receive on phone
          </p>
        </div>
      </div>
    </div>
  );
}
