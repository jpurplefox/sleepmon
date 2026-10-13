import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { api } from "../api/client";
import { useGate } from "../auth/useGate";
import type { ComparisonMap } from "../comparisonMap";
import { shareRequest } from "../comparisonShare";
import { useI18n } from "../i18n";
import type { RosterEntry } from "../roster";
import { canShareFiles, drawSheet, previewJpegBase64, shareOrDownload, sheetPng } from "../shareImage";
import { track } from "../telemetry/analytics";
import type { Catalog, Island, Production } from "../types";
import { ComparisonShareSheet } from "./ComparisonShareSheet";
import { Modal } from "./Modal";

interface Props {
  catalog: Catalog;
  entries: RosterEntry[];
  productions: (Production | null | undefined)[];
  map: ComparisonMap;
  island: Island | null;
  onClose: () => void;
}

type Picture =
  | { state: "drawing" }
  | { state: "ready"; canvas: HTMLCanvasElement; file: File; url: string }
  | { state: "error" };

type Link =
  | { state: "idle" }
  | { state: "creating" }
  | { state: "ready"; url: string; copied: boolean }
  | { state: "error" };

/**
 * Share the comparison (PRD 0020) as a picture of every card side by side, or as a
 * link whose preview is that same picture. The picture is drawn as the dialog opens,
 * so sharing it is instant (a phone only opens its share sheet straight from a tap).
 */
export function ShareDialog({ catalog, entries, productions, map, island, onClose }: Props) {
  const { t, lang } = useI18n();
  const { guard } = useGate();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [picture, setPicture] = useState<Picture>({ state: "drawing" });
  const [link, setLink] = useState<Link>({ state: "idle" });
  const pictureRef = useRef(picture);
  pictureRef.current = picture;
  const title = t("share.fileTitle", { names: entries.map((e) => e.config.species).join(" vs ") });

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      try {
        const node = sheetRef.current;
        if (!node) throw new Error("no sheet");
        const canvas = await drawSheet(node);
        const blob = await sheetPng(canvas);
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        const file = new File([blob], "sleepmon-comparison.png", { type: "image/png" });
        setPicture({ state: "ready", canvas, file, url });
      } catch {
        if (!cancelled) setPicture({ state: "error" });
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  const shareImage = async () => {
    if (picture.state !== "ready") return;
    const result = await shareOrDownload(picture.file, title);
    if (result !== "cancelled") track({ name: "comparison_shared", props: { kind: "image", cards: entries.length } });
  };

  const offerLink = async (url: string) => {
    // A phone opens its share sheet; elsewhere the link goes to the clipboard. Either
    // can be refused (the tap that allowed it was spent waiting for the server):
    // the link stays on screen with its own buttons.
    if (typeof navigator.share === "function") {
      await navigator.share({ url, title }).catch(() => undefined);
      return;
    }
    await copy(url);
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setLink({ state: "ready", url, copied: true });
    } catch {
      // No clipboard access: the link is on screen to copy by hand.
    }
  };

  const createLink = async () => {
    const current = pictureRef.current;
    if (current.state !== "ready") return;
    setLink({ state: "creating" });
    try {
      const data = await previewJpegBase64(current.canvas);
      const share = await api.createComparisonShare(
        shareRequest(entries, map, lang, { media_type: "image/jpeg", data }),
      );
      track({ name: "comparison_shared", props: { kind: "link", cards: entries.length } });
      setLink({ state: "ready", url: share.url, copied: false });
      await offerLink(share.url);
    } catch {
      setLink({ state: "error" });
    }
  };

  const ready = picture.state === "ready";

  return (
    <Modal title={t("share.title")} onClose={onClose}>
      <div className="share-dialog">
        <div className="share-dialog__preview">
          {picture.state === "ready" ? (
            <img src={picture.url} alt={t("share.previewAlt")} />
          ) : picture.state === "error" ? (
            <p className="error" role="alert">
              {t("share.drawError")}
            </p>
          ) : (
            <p className="muted" role="status">
              {t("share.drawing")}
            </p>
          )}
        </div>

        <div className="share-dialog__actions">
          <button type="button" className="btn btn--primary" disabled={!ready} onClick={shareImage}>
            {canShareFiles() ? t("share.shareImage") : t("share.downloadImage")}
          </button>
          {link.state !== "ready" && (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!ready || link.state === "creating"}
              onClick={() => guard(createLink, "share_link")}
            >
              {link.state === "creating" ? t("share.creatingLink") : t("share.shareLink")}
            </button>
          )}
        </div>

        {link.state === "error" && (
          <p className="error" role="alert">
            {t("share.linkError")}
          </p>
        )}
        {link.state === "ready" && (
          <div className="share-dialog__link">
            <input
              type="text"
              readOnly
              value={link.url}
              aria-label={t("share.linkLabel")}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button type="button" className="btn btn--ghost" onClick={() => copy(link.url)}>
              {link.copied ? t("share.copied") : t("share.copy")}
            </button>
            {typeof navigator.share === "function" && (
              <button type="button" className="btn btn--ghost" onClick={() => offerLink(link.url)}>
                {t("share.shareLinkAgain")}
              </button>
            )}
          </div>
        )}
        <p className="muted share-dialog__note">{t("share.note")}</p>
      </div>

      {/* Off screen, outside the modal: the picture is drawn from here. */}
      {createPortal(
        <div className="share-sheet-host" aria-hidden="true">
          <ComparisonShareSheet
            ref={sheetRef}
            catalog={catalog}
            entries={entries}
            productions={productions}
            map={map}
            island={island}
          />
        </div>,
        document.body,
      )}
    </Modal>
  );
}
