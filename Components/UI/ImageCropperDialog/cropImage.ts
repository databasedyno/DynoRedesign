/**
 * Canvas helpers for the image cropper.
 * Pure browser-side: loads the picked file (object URL), draws the selected
 * crop area onto a canvas and exports a Blob in a browser-encodable format.
 */
import type { Area } from "react-easy-crop";

/**
 * Formats the cropper can safely decode AND that keep their fidelity after a
 * canvas re-encode. SVG (vector), GIF (animation) and HEIC (no canvas decode
 * in most browsers) BYPASS the cropper and upload untouched, exactly like
 * before this feature existed.
 */
export const isCroppableImage = (mimetype: string | undefined): boolean =>
  typeof mimetype === "string" &&
  /^image\/(jpeg|jpg|pjpeg|png|webp|bmp|avif)$/i.test(mimetype.trim());

/** Longest output edge — plenty for avatars/logos, keeps uploads small. */
const MAX_OUTPUT_EDGE = 1024;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = src;
  });

/** Pick an output encoding the canvas actually supports. */
const outputMime = (sourceMime: string): string => {
  const m = (sourceMime || "").toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "image/jpeg";
  if (m.includes("webp")) return "image/webp";
  return "image/png"; // png/bmp/avif and anything else -> lossless png
};

export const extensionForMime = (mime: string): string => {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
};

/**
 * Render `cropAreaPixels` of the image at `imageSrc` onto a canvas and return
 * the encoded Blob (downscaled to MAX_OUTPUT_EDGE when the crop is larger).
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  cropAreaPixels: Area,
  sourceMime: string
): Promise<{ blob: Blob; mime: string }> {
  const image = await loadImage(imageSrc);

  const cropW = Math.max(1, Math.round(cropAreaPixels.width));
  const cropH = Math.max(1, Math.round(cropAreaPixels.height));
  const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(cropW, cropH));
  const outW = Math.max(1, Math.round(cropW * scale));
  const outH = Math.max(1, Math.round(cropH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    Math.round(cropAreaPixels.x),
    Math.round(cropAreaPixels.y),
    cropW,
    cropH,
    0,
    0,
    outW,
    outH
  );

  const mime = outputMime(sourceMime);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, mime === "image/jpeg" ? 0.92 : undefined)
  );
  if (!blob) throw new Error("Failed to encode cropped image");
  return { blob, mime: blob.type || mime };
}
