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
  UploadCloud,
  FileCheck2,
} from "lucide-react";
import { RadarPeer } from "@/types/protocol";
import { getDeviceInfo, generateShortRoomCode, generateEphemeralKey } from "@/lib/id";

interface LocalRadarProps {
  onSendToPeer: (
    targetPeerId: string,
    deviceInfo: string,
    files: File[],
    roomId: string,
    secretKey: string
  ) => Promise<void>;
  incomingInvite: {
    from: string;
    deviceInfo: string;
    roomId: string;
    secretKey: string;
    fileName?: string;
  } | null;
  onAcceptInvite: (roomId: string, secretKey: string) => void;
  onDeclineInvite?: () => void;
  hasFilesToSend: boolean;
  selectedFiles: File[];
  onFilesSelected?: (files: File[]) => void;
}

export function LocalRadar({
  onSendToPeer,
  incomingInvite,
  onAcceptInvite,
  onDeclineInvite,
  hasFilesToSend,
  selectedFiles,
  onFilesSelected,
}: LocalRadarProps) {
  const [radarPeers, setRadarPeers] = useState<RadarPeer[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectingPeerId, setConnectingPeerId] = useState<string | null>(null);
  const [pendingTargetPeer, setPendingTargetPeer] = useState<RadarPeer | null>(null);
  const [localInvite, setLocalInvite] = useState<{
    from: string;
    deviceInfo: string;
    roomId: string;
    secretKey: string;
    fileName?: string;
  } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const triggerAirDropSend = async (peer: RadarPeer, files: File[]) => {
    if (!files || files.length === 0) return;
    setConnectingPeerId(peer.peerId);

    try {
      // 1. Generate room credentials locally first
      const newRoomId = generateShortRoomCode();
      const secretKey = generateEphemeralKey();

      // 2. Send radar_invite message over the open radar socket BEFORE component unmounts
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const fileLabel =
          files.length === 1
            ? files[0].name
            : `${files.length} files (${files[0].name}, ...)`;

        console.log(`[AirDrop] Sending invite to ${peer.deviceInfo} for room ${newRoomId}`);
        socketRef.current.send(
          JSON.stringify({
            type: "radar_invite",
            to: peer.peerId,
            roomId: newRoomId,
            secretKey: secretKey,
            deviceInfo: getDeviceInfo(),
            fileName: fileLabel,
            fileCount: files.length,
          })
        );
      }

      // 3. 200ms delay to allow WebSocket packet transmission
      await new Promise((r) => setTimeout(r, 200));

      // 4. Enter transfer mode with the pre-generated room ID and key
      await onSendToPeer(peer.peerId, peer.deviceInfo, files, newRoomId, secretKey);
    } catch (err) {
      console.error("Failed to initiate AirDrop transfer:", err);
      setConnectingPeerId(null);
    }
  };

  const handleDeviceClick = async (peer: RadarPeer) => {
    if (selectedFiles && selectedFiles.length > 0) {
      // Direct send with already queued files
      await triggerAirDropSend(peer, selectedFiles);
    } else {
      // Trigger native file picker for this target device (AirDrop style)
      setPendingTargetPeer(peer);
      fileInputRef.current?.click();
    }
  };

  const handleNativeFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      if (onFilesSelected) {
        onFilesSelected(files);
      }
      const target = pendingTargetPeer || (radarPeers.length > 0 ? radarPeers[0] : null);
      if (target) {
        await triggerAirDropSend(target, files);
        setPendingTargetPeer(null);
      }
    }
  };

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
      {/* Hidden file input for one-click AirDrop file selection */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleNativeFilesSelected}
        className="hidden"
      />

      {/* AirDrop Incoming Invite Alert Modal/Card */}
      {effectiveInvite && (
        <div className="rounded-2xl border-2 border-emerald-500/80 dark:border-emerald-400/80 bg-white dark:bg-neutral-900 p-6 sm:p-7 shadow-xl animate-in fade-in zoom-in-95">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0 shadow-xs">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  AirDrop Request
                </span>
                <span className="text-xs text-neutral-400">• Local Wi-Fi</span>
              </div>

              <h4 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                {effectiveInvite.deviceInfo}
              </h4>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">
                Wants to send:{" "}
                <span className="font-semibold text-neutral-900 dark:text-neutral-100 font-mono">
                  {effectiveInvite.fileName || "Selected Files"}
                </span>{" "}
                directly to your device.
              </p>

              <div className="flex items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => onAcceptInvite(effectiveInvite.roomId, effectiveInvite.secretKey)}
                  className="px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black text-xs font-bold shadow-md transition-all scale-100 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                  <span>Accept & Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocalInvite(null);
                    onDeclineInvite?.();
                  }}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
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
                Local Wi-Fi Radar (AirDrop Style)
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {isConnected ? "Radar Active" : "Connecting..."}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Zero-config discovery across devices on the same Wi-Fi router. Click any device to stream files directly.
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
                Open <span className="font-mono text-black dark:text-white">peerwarp.com</span> on your phone, tablet, or another laptop on the same Wi-Fi to pair automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-neutral-500 font-medium px-1">
              <span>Nearby Devices ({radarPeers.length})</span>
              <span>Click to select files & stream</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {radarPeers.map((peer) => (
                <div
                  key={peer.peerId}
                  onClick={() => handleDeviceClick(peer)}
                  className="group p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-950/30 hover:bg-neutral-50 dark:hover:bg-neutral-900/60 transition-all flex items-center justify-between gap-3 shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      {getDeviceIcon(peer.deviceInfo)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                        {peer.deviceInfo}
                      </p>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                        <span>Ready to receive</span>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeviceClick(peer);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black text-xs font-bold shadow-xs hover:shadow transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    {connectingPeerId === peer.peerId ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Invite...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send to Device</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 flex items-center justify-between text-xs text-neutral-500 border-t border-neutral-100 dark:border-neutral-800/80">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-neutral-400" />
            Zero cloud storage • Direct device-to-device streaming
          </span>
          <span className="font-mono">{radarPeers.length} device{radarPeers.length === 1 ? "" : "s"} online</span>
        </div>
      </div>
    </div>
  );
}
