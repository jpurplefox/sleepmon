// The picture of a comparison (PRD 0020): drawn from the off-screen sheet that lays
// every card side by side, then shared as a file or uploaded as a link's preview.
import { toCanvas } from "html-to-image";

/** Sharp on a phone's screen without making a five-card picture huge. */
const PIXEL_RATIO = 2;
/** The link preview: crawlers want it light (WhatsApp drops heavy ones). */
const PREVIEW_MAX_WIDTH = 1200;
const PREVIEW_QUALITY = 0.85;

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

/** A lighter JPEG of the same picture for the link preview, as base64. */
export async function previewJpegBase64(canvas: HTMLCanvasElement): Promise<string> {
  const scale = Math.min(1, PREVIEW_MAX_WIDTH / canvas.width);
  const out = document.createElement("canvas");
  out.width = Math.round(canvas.width * scale);
  out.height = Math.round(canvas.height * scale);
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  const blob = await toBlob(out, "image/jpeg", PREVIEW_QUALITY);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Shares the picture where the device can (a phone's share sheet); else downloads it. */
export async function shareOrDownload(file: File, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // Not allowed here (e.g. a lost user gesture): saving it still works.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}

/** Whether this device can hand a picture to other apps (else the button downloads). */
export function canShareFiles(): boolean {
  if (typeof navigator.canShare !== "function" || typeof File === "undefined") return false;
  try {
    return navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}
