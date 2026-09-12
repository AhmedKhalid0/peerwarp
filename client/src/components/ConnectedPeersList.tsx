"use client";

import React from "react";
import { Users, Smartphone, Laptop, CheckCircle2, Loader2, X } from "lucide-react";
import { RecipientPeer } from "@/types/protocol";

interface ConnectedPeersListProps {
  peers: RecipientPeer[];
  maxPeers: number;
  onDisconnectPeer: (peerId: string) => void;
}

export function ConnectedPeersList({ peers, maxPeers, onDisconnectPeer }: ConnectedPeersListProps) {
  if (peers.length === 0) return null;

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-neutral-500" />
          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
            Connected Recipients ({peers.length}/{maxPeers})
          </span>
        </div>
        <span className="text-[11px] text-neutral-400 font-mono">
          Live P2P Mesh
        </span>
      </div>

      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
        {peers.map((peer) => {
          const isMobile = /iPhone|Android|iPad/i.test(peer.deviceInfo);
          return (
            <div key={peer.peerId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 shrink-0">
                  {isMobile ? <Smartphone className="w-3.5 h-3.5" /> : <Laptop className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                    {peer.deviceInfo || "Colleague"}
                  </p>
                  <p className="text-[10px] text-neutral-400 font-mono">
                    ID: {peer.peerId.replace("peer_", "")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Approved & Connected</span>
                </span>

                <button
                  onClick={() => onDisconnectPeer(peer.peerId)}
                  className="p-1 rounded-md text-neutral-400 hover:text-rose-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  title="Disconnect peer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
