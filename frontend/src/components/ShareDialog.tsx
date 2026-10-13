import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useGate } from "../auth/useGate";
import type { ComparisonMap } from "../comparisonMap";
import {
  cachedShareUrl,
  displayUrl,
  pendingShare,
  rememberShareUrl,
  shareCacheKey,
  shareRequest,
  trackPendingShare,
} from "../comparisonShare";
import { useI18n } from "../i18n";
import type { RosterEntry } from "../roster";
import { canCopyImage, downloadBlob, drawSheet, previewJpegBase64, sheetPng } from "../shareImage";
import { track } from "../telemetry/analytics";
import { renderTurnstile, TURNSTILE_SITE_KEY } from "../turnstile";
import type { Catalog, Island, Production, SleepSchedule } from "../types";
import { ComparisonShareSheet } from "./ComparisonShareSheet";
import { IconCheck, IconCopy, IconDownload, IconLink } from "./icons";
import { Modal } from "./Modal";

interface Props {
  catalog: Catalog;
  entries: RosterEntry[];
  productions: (Production | null | undefined)[];
  map: ComparisonMap;
  island: Island | null;
  sleep: SleepSchedule;
  onClose: () => void;
}

type Picture =
  | { state: "drawing" }
  | { state: "ready"; canvas: HTMLCanvasElement; blob: Blob; url: string }
  | { state: "error" };

type Link =
  | { state: "idle" }
  | { state: "creating" }
  | { state: "ready"; url: string }
  | { state: "error"; reason: "verify" | "other" };

const FILE_NAME = "sleepmon-comparison.png";
/** How long a Copy button reads "Copied!". */
const COPIED_MS = 2000;

/** A flag that turns itself off after COPIED_MS (and never fires after unmount). */
function useFlash(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = useCallback(() => {
    clearTimeout(timer.current);
    setOn(true);
    timer.current = setTimeout(() => setOn(false), COPIED_MS);
  }, []);
  return [on, flash];
}

/**
 * Share the comparison (PRD 0020) as a picture of every card side by side, or as a
 * link whose preview is that same picture. The picture is drawn as the dialog opens,
 * and the link is created right after it (or reused, if this comparison already has
 * one this session), so both are ready before anyone copies them.
 */
export function ShareDialog({ catalog, entries, productions, map, island, sleep, onClose }: Props) {
  const { t, lang } = useI18n();
  const { guard } = useGate();
  const { status } = useAuth();
  const verifyRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [picture, setPicture] = useState<Picture>({ state: "drawing" });
  const [link, setLink] = useState<Link>({ state: "idle" });
  const [imageCopied, flashImageCopied] = useFlash();
  const [linkCopied, flashLinkCopied] = useFlash();
  const pictureRef = useRef(picture);
  pictureRef.current = picture;
  const startedRef = useRef(false);
  const linkTrackedRef = useRef(false);
  const imageLabelId = useId();
  const linkLabelId = useId();
  const cacheKey = shareCacheKey(entries, map, sleep, lang);
  const cards = entries.length;

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
        setPicture({ state: "ready", canvas, blob, url });
      } catch {
        if (!cancelled) setPicture({ state: "error" });
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  const createLink = async (verify: boolean) => {
    const current = pictureRef.current;
    if (current.state !== "ready") return;
    setLink({ state: "creating" });
    let token: string | null = null;
    try {
      if (verify) {
        if (!verifyRef.current) throw new Error("verification");
        token = await renderTurnstile(verifyRef.current, TURNSTILE_SITE_KEY);
      }
    } catch {
      setLink({ state: "error", reason: "verify" });
      return;
    }
    try {
      const creation = (async () => {
        const data = await previewJpegBase64(current.canvas);
        const share = await api.createComparisonShare(
          shareRequest(entries, map, sleep, lang, { media_type: "image/jpeg", data }, token),
        );
        rememberShareUrl(cacheKey, share.url);
        return share.url;
      })();
      trackPendingShare(cacheKey, creation);
      setLink({ state: "ready", url: await creation });
    } catch (err) {
      setLink({
        state: "error",
        reason: err instanceof ApiError && err.status === 403 ? "verify" : "other",
      });
    }
  };

  // Signed out without a configured human check (local dev) there is nothing to create
  // automatically: the user signs in first. The guarded call runs after sign-in from
  // this render's closure, so it never verifies.
  const needsSignIn = status !== "authenticated" && !TURNSTILE_SITE_KEY;
  const startLink = () => {
    if (status === "authenticated") return createLink(false);
    if (TURNSTILE_SITE_KEY) return createLink(true);
    return guard(() => createLink(false), "share_link");
  };

  // Once the picture is ready (the link's preview comes from it) and we know who is
  // signed in: reuse this comparison's link, or create it. Only once per dialog.
  useEffect(() => {
    if (picture.state !== "ready" || status === "checking" || startedRef.current) return;
    startedRef.current = true;
    const cached = cachedShareUrl(cacheKey);
    if (cached) {
      setLink({ state: "ready", url: cached });
      return;
    }
    // Closed and reopened while the first dialog's creation is still running: wait for it.
    const pending = pendingShare(cacheKey);
    if (pending) {
      setLink({ state: "creating" });
      pending.then(
        (url) => setLink({ state: "ready", url }),
        () => setLink({ state: "error", reason: "other" }),
      );
      return;
    }
    if (!needsSignIn) void startLink();
    // startLink reads this render's props; the ref keeps it to the first ready render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picture.state, status]);

  const copyImage = async () => {
    if (picture.state !== "ready") return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": picture.blob })]);
    } catch {
      return; // Refused: the button just doesn't say "Copied!".
    }
    flashImageCopied();
    track({ name: "comparison_shared", props: { kind: "image", cards } });
  };

  const downloadImage = () => {
    if (picture.state !== "ready") return;
    downloadBlob(picture.blob, FILE_NAME);
    track({ name: "comparison_shared", props: { kind: "image", cards } });
  };

  const copyLink = async () => {
    if (link.state !== "ready") return;
    try {
      await navigator.clipboard.writeText(link.url);
    } catch {
      return; // No clipboard access: the link is on screen to copy by hand.
    }
    flashLinkCopied();
    if (!linkTrackedRef.current) {
      linkTrackedRef.current = true;
      track({ name: "comparison_shared", props: { kind: "link", cards } });
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

        <div className="share-dialog__section" role="group" aria-labelledby={imageLabelId}>
          <span id={imageLabelId} className="share-dialog__label">
            {t("share.imageSection")}
          </span>
          <div className="share-dialog__actions">
            {canCopyImage() && (
              <button type="button" className="btn btn--ghost btn--icon-lead" disabled={!ready} onClick={copyImage}>
                {imageCopied ? <IconCheck /> : <IconCopy />}
                {imageCopied ? t("share.imageCopied") : t("share.copy")}
              </button>
            )}
            <button type="button" className="btn btn--ghost btn--icon-lead" disabled={!ready} onClick={downloadImage}>
              <IconDownload />
              {t("share.download")}
            </button>
          </div>
          <span role="status" aria-live="polite" className="sr-only">
            {imageCopied ? t("share.imageCopied") : ""}
          </span>
        </div>

        {picture.state !== "error" && (
          <div className="share-dialog__section" role="group" aria-labelledby={linkLabelId}>
            <span id={linkLabelId} className="share-dialog__label">
              {t("share.linkSection")}
            </span>
            <p className="share-dialog__value">{t("share.linkValue")}</p>
            {link.state === "error" ? (
              <div className="share-dialog__link share-dialog__link--error">
                <p className="error" role="alert">
                  {t(link.reason === "verify" ? "share.verifyError" : "share.linkError")}
                </p>
                <button type="button" className="btn btn--ghost" onClick={startLink}>
                  {t("share.retry")}
                </button>
              </div>
            ) : link.state === "idle" && needsSignIn && ready ? (
              <div className="share-dialog__link">
                <button type="button" className="btn btn--ghost" onClick={startLink}>
                  {t("share.signInForLink")}
                </button>
              </div>
            ) : (
              <div className="share-dialog__link">
                <div className="share-dialog__field">
                  <IconLink />
                  {link.state === "ready" ? (
                    <input
                      type="text"
                      readOnly
                      value={displayUrl(link.url)}
                      aria-label={t("share.linkLabel")}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                  ) : (
                    <span className="muted" role="status">
                      {t("share.creatingLink")}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className={`btn btn--primary btn--icon-lead${linkCopied ? " share-dialog__copied" : ""}`}
                  disabled={link.state !== "ready"}
                  onClick={copyLink}
                >
                  {linkCopied ? <IconCheck /> : <IconCopy />}
                  {linkCopied ? t("share.copied") : t("share.copy")}
                </button>
              </div>
            )}
            {/* Where Cloudflare shows a challenge, if it asks for one. */}
            <div ref={verifyRef} className="share-dialog__verify" />
            <span role="status" aria-live="polite" className="sr-only">
              {linkCopied ? t("share.copied") : ""}
            </span>
          </div>
        )}
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
            sleep={sleep}
          />
        </div>,
        document.body,
      )}
    </Modal>
  );
}
