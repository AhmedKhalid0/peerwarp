"use client";

import React, { useEffect, useRef, useState } from "react";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: (error: any) => void;
  onExpire?: () => void;
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: (error: any) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "invisible";
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoaded?: () => void;
  }
}

export function TurnstileWidget({
  onVerify,
  onError,
  onExpire,
  className = "",
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isScriptReady, setIsScriptReady] = useState(false);

  // Cloudflare default test sitekey (always passes) or custom configured key
  const siteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

  useEffect(() => {
    // 1. Inject Turnstile script if not already present
    if (typeof window !== "undefined") {
      if (window.turnstile) {
        setIsScriptReady(true);
        return;
      }

      const existingScript = document.getElementById("cf-turnstile-script");
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "cf-turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          setIsScriptReady(true);
        };
        document.head.appendChild(script);
      } else {
        const checkInterval = setInterval(() => {
          if (window.turnstile) {
            clearInterval(checkInterval);
            setIsScriptReady(true);
          }
        }, 100);
        return () => clearInterval(checkInterval);
      }
    }
  }, []);

  useEffect(() => {
    if (!isScriptReady || !containerRef.current || !window.turnstile) return;

    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch (_) {}
    }

    try {
      const widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          onVerify(token);
        },
        "error-callback": (err) => {
          onError?.(err);
        },
        "expired-callback": () => {
          onExpire?.();
        },
        theme: "auto",
        size: "normal",
      });
      widgetIdRef.current = widgetId;
    } catch (err) {
      console.warn("[Turnstile] Render error:", err);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (_) {}
      }
    };
  }, [isScriptReady, siteKey, onVerify, onError, onExpire]);

  return (
    <div className={`flex justify-center my-2 ${className}`}>
      <div ref={containerRef} />
    </div>
  );
}
