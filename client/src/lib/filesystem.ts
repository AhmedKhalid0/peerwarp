/**
 * Direct-to-Disk streaming engine using the native File System Access API.
 * Bypasses browser RAM completely by piping WebRTC chunks straight to the hard drive.
 * Enables zero-crash transfers for 10 GB to 50 GB+ files on desktop and Android Chrome/Edge.
 */

export function supportsFileSystemAccess(): boolean {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

export async function createDirectFileWriter(
  suggestedName: string
): Promise<FileSystemWritableFileStream | null> {
  if (!supportsFileSystemAccess()) return null;

  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName,
    });
    return await handle.createWritable();
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log("[FileSystem] User dismissed save file picker. Falling back to memory buffer.");
    } else {
      console.warn("[FileSystem] showSaveFilePicker failed:", err);
    }
    return null;
  }
}
