"use client";

/**
 * Shrink a photo in the browser before upload: longest edge ≤ 1568 px (the size Claude
 * works best with), re-encoded as JPEG. A 5 MB phone photo usually ends up ~200–400 KB.
 */
export async function compressImage(file: File, maxEdge = 1568, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Couldn't process this image.");
  if (blob.size > 10 * 1024 * 1024) throw new Error("Image is too large even after compression.");
  return blob;
}
