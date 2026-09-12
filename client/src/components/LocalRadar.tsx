"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Wifi,
  Smartphone,
  Laptop,
  Radio,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { RadarPeer } from "@/types/protocol";
import { getDeviceInfo } from "@/lib/id";

interface LocalRadarProps {
  onSendToPeer: (targetPeerId: string, deviceInfo: string) => void;
  incomingInvite: {
    from: string;
    deviceInfo: string;
    roomId: string;
    secretKey: string;
    fileName?: string;
  } | null;
  onAcceptInvite: (roomId: string, secretKey: string) => void;
  onDeclineInvite: () => void;
  hasFilesToSend: boolean;
}

export function LocalRadar({
  onSendToPeer,
  incomingInvite,
  onAcceptInvite,
  onDeclineInvite,
  hasFilesToSend,
}: LocalRadarProps) {
  const [radarPeers, setRadarPeers] = useState<RadarPeer[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectingPeerId, setConnectingPeerId] = useState<string | null>(null);
  const [localInvite, setLocalInvite] = useState<{
    from: string;
    deviceInfo: string;
    roomId: string;
    secretKey: string;
    fileName?: string;
  } | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let keepAliveTimer: any = null;

    const connectRadar = () => {
      try {
        const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
        const wsProtocol = isSecure ? "wss:" : "ws:";
        const host = typeof window !== "undefined" ? window.location.host : "peerwarp.com";
        const deviceInfo = encodeURIComponent(getDeviceInfo());

        const wsUrl = `${wsProtocol}//${host}/ws/radar?radar=true&device=${deviceInfo}`;
        ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          keepAliveTimer = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ping" }));
            }
          }, 20000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "radar_peers" && Array.isArray(data.radarPeers)) {
              setRadarPeers(data.radarPeers);
            } else if (data.type === "radar_invite") {
              setLocalInvite(data);
            }
          } catch (_) {}
        };

        ws.onclose = () => {
          setIsConnected(false);
          clearInterval(keepAliveTimer);
        };

        ws.onerror = () => {
          setIsConnected(false);
        };
      } catch (_) {}
    };

    connectRadar();

    return () => {
      clearInterval(keepAliveTimer);
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const getDeviceIcon = (deviceInfo: string) => {
    const lower = deviceInfo.toLowerCase();
    if (lower.includes("iphone") || lower.includes("android") || lower.includes("mobile")) {
      return <Smartphone className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />;
    }
    return <Laptop className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />;
  };

  const effectiveInvite = localInvite || incomingInvite;

  return (
    <div className="space-y-6">
      {/* Incoming Invite Alert Modal/Card */}
      {effectiveInvite && (
        <div className="rounded-2xl border-2 border-black dark:border-white bg-white dark:bg-neutral-900 p-6 shadow-md animate-in fade-in zoom-in-95">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
              <Radio className="w-6 h-6 text-black dark:text-white animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Incoming Transfer Invite
              </span>
              <h4 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                {effectiveInvite.deviceInfo}
              </h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Wants to stream files directly to your device via end-to-end encrypted WebRTC.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => onAcceptInvite(effectiveInvite.roomId, effectiveInvite.secretKey)}
                  className="px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Accept & Receive
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocalInvite(null);
                    onDeclineInvite?.();
                  }}
                  className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Radar Scanner Visual & Peer List */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Local Wi-Fi Radar
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {isConnected ? "Radar Active" : "Connecting..."}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Zero-config discovery for devices connected to the same Wi-Fi network. No codes needed.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono">
            <Wifi className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
            <span>Same Network Only</span>
          </div>
        </div>

        {/* Discovered Peers or Scanning State */}
        {radarPeers.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-neutral-300 dark:border-neutral-700 animate-ping opacity-30" />
              <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <Radio className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
              </div>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Scanning for nearby devices...
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm">
                Open <span className="font-mono text-black dark:text-white">peerwarp.com</span> on your phone, tablet, or another computer on the same Wi-Fi to pair automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {radarPeers.map((peer) => (
              <div
                key={peer.peerId}
                className="group p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-950/30 hover:bg-neutral-50 dark:hover:bg-neutral-950/60 transition-all flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center shrink-0 shadow-2xs">
                    {getDeviceIcon(peer.deviceInfo)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {peer.deviceInfo}
                    </p>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      Ready to pair
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setConnectingPeerId(peer.peerId);
                    onSendToPeer(peer.peerId, peer.deviceInfo);
                  }}
                  className="px-3 py-2 rounded-lg bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black text-xs font-semibold shadow-2xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  {connectingPeerId === peer.peerId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{hasFilesToSend ? "Send Files" : "Pair Device"}</span>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 flex items-center justify-between text-xs text-neutral-500 border-t border-neutral-100 dark:border-neutral-800/80">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-neutral-400" />
            Radar broadcasts never touch external servers or public logs
          </span>
          <span className="font-mono">{radarPeers.length} peer{radarPeers.length === 1 ? "" : "s"} nearby</span>
        </div>
      </div>
    </div>
  );
}
