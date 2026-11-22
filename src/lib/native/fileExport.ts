import { appName } from '@/lib/version';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Saving a file on Android.
 *
 * A browser download has no meaning inside a WebView, so the phone writes the
 * blob into the app's Documents folder and opens the system share sheet. The
 * customer can then keep the file, send it to Drive, or open the folder in Files.
 * The desktop app and the browser keep using the normal anchor download.
 */
export const isNativeApp = () => Capacitor.isNativePlatform();

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('could not read the file'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export async function saveBlobNative(blob: Blob, filename: string) {
  const folder = appName();
  const path = `${folder}/${filename}`;
  const data = await toBase64(blob);

  await Filesystem.writeFile({
    path,
    data,
    directory: Directory.Documents,
    recursive: true,
  });

  const { uri } = await Filesystem.getUri({ path, directory: Directory.Documents });
  try {
    await Share.share({ title: filename, url: uri, dialogTitle: filename });
  } catch {
    // A dismissed share sheet is not an error; the file is already saved.
  }

  window.dispatchEvent(new CustomEvent('msap:file-saved', { detail: { filename } }));
  return uri;
}
