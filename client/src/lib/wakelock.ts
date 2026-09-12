/**
 * Screen Wake Lock Manager for mobile devices (iOS Safari 16.4+ and Android Chrome).
 * Prevents device sleep/screen timeout during active WebRTC file transfers.
 */

class WakeLockManager {
  private sentinel: any = null;

  public async request(): Promise<boolean> {
    if (typeof window === "undefined" || !("wakeLock" in navigator)) {
      return false;
    }
    try {
      this.sentinel = await (navigator as any).wakeLock.request("screen");
      this.sentinel.addEventListener("release", () => {
        this.sentinel = null;
      });
      return true;
    } catch (e) {
      console.warn("[WakeLock] Failed to acquire screen lock:", e);
      return false;
    }
  }

  public release(): void {
    if (this.sentinel) {
      try {
        this.sentinel.release();
      } catch (_) {}
      this.sentinel = null;
    }
  }
}

export const wakeLock = new WakeLockManager();
