/**
 * Compress and resize an image file to keep memory and storage usage reasonable.
 * Reference images don't need to be full resolution — 768px max side is plenty
 * for the Gemini API to understand style/composition.
 */

const MAX_DIMENSION = 768;
const JPEG_QUALITY = 0.75;

export function compressImage(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if needed
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Use JPEG for photos (smaller), PNG for images with transparency
      const isPNG = file.type === 'image/png';
      const mimeType = isPNG ? 'image/png' : 'image/jpeg';
      const quality = isPNG ? undefined : JPEG_QUALITY;

      const dataUrl = canvas.toDataURL(mimeType, quality);
      resolve({ dataUrl, mimeType });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    img.src = url;
  });
}

/**
 * Process multiple files sequentially to avoid memory spikes.
 * Yields progress callbacks for UI updates.
 */
export async function compressImages(
  files: File[],
  onProgress?: (done: number, total: number, fileName: string) => void
): Promise<{ dataUrl: string; mimeType: string; name: string }[]> {
  const results: { dataUrl: string; mimeType: string; name: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i, files.length, file.name);

    try {
      const compressed = await compressImage(file);
      results.push({ ...compressed, name: file.name });
    } catch (err) {
      console.warn(`[Daxer] Skipping ${file.name}:`, err);
    }
  }

  onProgress?.(files.length, files.length, '');
  return results;
}
