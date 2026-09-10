import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Shield, Zap, Heart } from "lucide-react";

export const metadata: Metadata = {
  title: "PeerWarp — 100% Free, Zero-Cloud-Storage P2P Direct File Transfer",
  description:
    "Stream files directly device-to-device with WebRTC DataChannels. Unlimited file sizes, zero server storage, end-to-end encrypted, and 100% free forever.",
  keywords: [
    "P2P file transfer",
    "WebRTC",
    "AirDrop alternative",
    "WeTransfer alternative",
    "send large files free",
    "peer-to-peer streaming",
    "private file share",
    "zero cloud storage",
  ],
  authors: [{ name: "Ahmed Khaled (Ahmed Algendy)", url: "https://ahmedalgendy.com" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 flex flex-col">{children}</main>

        <footer className="border-t border-slate-200/80 dark:border-zinc-800/80 py-8 bg-slate-50/50 dark:bg-zinc-950 text-xs text-slate-500 dark:text-zinc-500">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">PeerWarp</span>
              <span>•</span>
              <span>100% Free & Open Source</span>
              <span>•</span>
              <span>MIT License</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
              <span>Engineered with care by</span>
              <a
                href="https://ahmedalgendy.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Ahmed Khaled (Ahmed Algendy)
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
