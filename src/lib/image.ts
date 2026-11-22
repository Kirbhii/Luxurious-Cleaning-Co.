/** Shrink a photo in the browser before it leaves the phone.
 *
 *  A modern phone camera produces 3–8 MB per shot, and one booking can collect
 *  a dozen. Sending that straight up is slow on mobile data and expensive to
 *  store. Resizing the long edge to 1600px and re-encoding as JPEG keeps a
 *  readable record of the work at roughly 150–350 KB.
 *
 *  Throws with a sentence that can be shown to the user as-is.
 */
export async function compressImage(
  file: File,
  maxEdge = 1600,
  quality = 0.72
): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not a photo.');
  }

  // createImageBitmap applies the EXIF orientation, so a portrait shot taken
  // sideways does not arrive rotated.
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    throw new Error('That photo could not be read. Try a different one.');
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new Error('This browser cannot resize photos.');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  );
  if (!blob) {
    throw new Error('That photo could not be prepared for upload.');
  }
  return blob;
}
