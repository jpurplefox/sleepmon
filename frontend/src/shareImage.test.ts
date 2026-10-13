import { afterEach, describe, expect, it, vi } from "vitest";

import { canCopyImage, downloadBlob, MAX_PREVIEW_BYTES, previewAttempts, previewJpegBase64 } from "./shareImage";

describe("previewAttempts", () => {
  it("steps down in quality at full width, then to a smaller picture", () => {
    expect(previewAttempts()).toEqual([
      { width: 1200, quality: 0.85 },
      { width: 1200, quality: 0.7 },
      { width: 1200, quality: 0.55 },
      { width: 800, quality: 0.55 },
    ]);
  });
});

describe("previewJpegBase64", () => {
  afterEach(() => vi.restoreAllMocks());

  /** Every encode returns the next size in the list (a blob of that many bytes). */
  function encodeSizes(sizes: number[]) {
    const qualities: number[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: () => {} } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb, _type, quality) {
      qualities.push(quality as number);
      cb(new Blob([new Uint8Array(sizes[qualities.length - 1])]));
    });
    return qualities;
  }
  const source = () => Object.assign(document.createElement("canvas"), { width: 2400, height: 1000 });

  it("keeps the first encoding that fits", async () => {
    const qualities = encodeSizes([MAX_PREVIEW_BYTES]);
    await previewJpegBase64(source());
    expect(qualities).toEqual([0.85]);
  });

  it("retries at lower quality when it is too big", async () => {
    const qualities = encodeSizes([MAX_PREVIEW_BYTES + 1, MAX_PREVIEW_BYTES + 1, 1000]);
    await previewJpegBase64(source());
    expect(qualities).toEqual([0.85, 0.7, 0.55]);
  });

  it("gives up with an error when nothing fits", async () => {
    encodeSizes([MAX_PREVIEW_BYTES + 1, MAX_PREVIEW_BYTES + 1, MAX_PREVIEW_BYTES + 1, MAX_PREVIEW_BYTES + 1]);
    await expect(previewJpegBase64(source())).rejects.toThrow("preview too large");
  });
});

describe("downloadBlob", () => {
  afterEach(() => vi.restoreAllMocks());

  it("saves the blob under the given name", () => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const clicked: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download });
    });
    downloadBlob(new Blob(["png"]), "sleepmon-comparison.png");
    expect(clicked).toEqual([{ href: "blob:x", download: "sleepmon-comparison.png" }]);
    expect(document.querySelector("a[download]")).toBeNull();
  });
});

describe("canCopyImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("is false without ClipboardItem or clipboard.write", () => {
    vi.stubGlobal("ClipboardItem", undefined);
    expect(canCopyImage()).toBe(false);
    vi.stubGlobal("ClipboardItem", class {});
    Object.defineProperty(navigator, "clipboard", { value: {}, configurable: true });
    expect(canCopyImage()).toBe(false);
  });

  it("is true when the browser can write images to the clipboard", () => {
    vi.stubGlobal("ClipboardItem", class {});
    Object.defineProperty(navigator, "clipboard", { value: { write: async () => {} }, configurable: true });
    expect(canCopyImage()).toBe(true);
  });
});
