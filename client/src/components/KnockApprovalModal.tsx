"use client";

import React from "react";
import { ShieldCheck, UserCheck, XCircle, Smartphone } from "lucide-react";

interface KnockApprovalModalProps {
  knock: {
    peerId: string;
    deviceInfo: string;
  } | null;
  onApprove: (peerId: string) => void;
  onReject: (peerId: string) => void;
}

export function KnockApprovalModal({ knock, onApprove, onReject }: KnockApprovalModalProps) {
  if (!knock) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 sm:p-8 shadow-2xl space-y-6 text-center">
        {/* Shield Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center mx-auto shadow-xs">
          <ShieldCheck className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/50 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-900/60">
            Knock-to-Join Request
          </span>
          <h3 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Recipient Requesting Access
          </h3>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
            A device is attempting to join this transfer room. Only approve if you shared the link with this person.
          </p>
        </div>

        {/* Device Info Badge */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/70 border border-neutral-200/80 dark:border-neutral-700/80 flex items-center justify-center gap-3">
          <Smartphone className="w-5 h-5 text-neutral-600 dark:text-neutral-300 shrink-0" />
          <div className="text-left min-w-0">
            <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Device Detected</p>
            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-100 truncate">
              {knock.deviceInfo || "Mobile / Web Device"}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => onReject(knock.peerId)}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold text-xs transition-colors"
          >
            <XCircle className="w-4 h-4 text-rose-500" />
            <span>Decline</span>
          </button>

          <button
            onClick={() => onApprove(knock.peerId)}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black font-semibold text-xs shadow-xs transition-colors"
          >
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Accept & Stream</span>
          </button>
        </div>
      </div>
    </div>
  );
}
