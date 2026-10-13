// The picture of a comparison (PRD 0020): drawn from the off-screen sheet that lays
// every card side by side, then copied, downloaded or uploaded as a link's preview.
import { toCanvas } from "html-to-image";

/** Sharp on a phone's screen without making a five-card picture huge. */
const PIXEL_RATIO = 2;
/** The link preview: crawlers want it light (WhatsApp drops heavy ones). */
const PREVIEW_MAX_WIDTH = 1200;
const PREVIEW_QUALITY = 0.85;
/** The server refuses bigger previews (500 KB): step down until one fits. */
export const MAX_PREVIEW_BYTES = 500_000;
const FALLBACK_QUALITIES = [0.7, 0.55];
const FALLBACK_WIDTH = 800;

/** The encodings to try, best first: lower quality at full width, then a smaller one. */
export function previewAttempts(): { width: number; quality: number }[] {
  return [
    { width: PREVIEW_MAX_WIDTH, quality: PREVIEW_QUALITY },
    ...FALLBACK_QUALITIES.map((quality) => ({ width: PREVIEW_MAX_WIDTH, quality })),
    { width: FALLBACK_WIDTH, quality: FALLBACK_QUALITIES[FALLBACK_QUALITIES.length - 1] },
  ];
}

// WebKit (Safari, and every iOS browser) paints images inside the SVG snapshot only
// once they are cached by a first pass: the first draw comes out without them.
function needsWarmUp(): boolean {
  const ua = navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua) || (/Safari\//.test(ua) && !/Chrome|Chromium|Android/.test(ua));
}

async function imagesLoaded(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );
}

export async function drawSheet(node: HTMLElement): Promise<HTMLCanvasElement> {
  await imagesLoaded(node);
  const options = { pixelRatio: PIXEL_RATIO, cacheBust: false };
  if (needsWarmUp()) await toCanvas(node, options);
  return toCanvas(node, options);
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), type, quality),
  );
}

/** The full-size PNG, the one a person shares or saves. */
export function sheetPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return toBlob(canvas, "image/png");
}

async function encodePreview(canvas: HTMLCanvasElement, width: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, width / canvas.width);
  const out = document.createElement("canvas");
  out.width = Math.round(canvas.width * scale);
  out.height = Math.round(canvas.height * scale);
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return toBlob(out, "image/jpeg", quality);
}

/** A lighter JPEG of the same picture for the link preview, as base64, under MAX_PREVIEW_BYTES. */
export async function previewJpegBase64(canvas: HTMLCanvasElement): Promise<string> {
  let blob: Blob | null = null;
  for (const { width, quality } of previewAttempts()) {
    const attempt = await encodePreview(canvas, width, quality);
    if (attempt.size <= MAX_PREVIEW_BYTES) {
      blob = attempt;
      break;
    }
  }
  if (!blob) throw new Error("preview too large");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Saves the blob as a file named `name`. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Whether this browser can put a picture on the clipboard (else Copy isn't offered). */
export function canCopyImage(): boolean {
  return typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;
}
