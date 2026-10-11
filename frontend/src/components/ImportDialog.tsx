import { useEffect, useRef, useState } from "react";

import { api, ApiError } from "../api/client";
import { useI18n } from "../i18n";
import { checkFile, MAX_SHOTS, toImportedForm } from "../screenshotImport";
import { shrinkImage } from "../shrinkImage";
import { track } from "../telemetry/analytics";
import type { Catalog, ImportedForm } from "../types";
import { Modal } from "./Modal";
import { ShotSlots } from "./ShotSlots";

// The daily-cap reset time, remembered for the session so a reopened dialog skips the round trip.
let knownResetAt: string | null = null;

/** Drops the remembered reset time (the signed-in account changed). */
export function forgetImportLimit(): void {
  knownResetAt = null;
}

export function rememberImportLimit(resetsAt: string | null): void {
  knownResetAt = resetsAt;
}

export function futureReset(): string | null {
  return knownResetAt && new Date(knownResetAt).getTime() > Date.now() ? knownResetAt : null;
}

interface Props {
  catalog: Catalog;
  onClose: () => void;
  onImported: (form: ImportedForm) => void;
}

export function ImportDialog({ catalog, onClose, onImported }: Props) {
  const { t, lang } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [resetsAt, setResetsAt] = useState<string | null>(futureReset);
  const [phase, setPhase] = useState<"idle" | "reading" | "limit">(resetsAt ? "limit" : "idle");
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const add = (incoming: File[]) => {
    setFiles((prev) => [...prev, ...incoming].slice(0, MAX_SHOTS));
    setError(null);
  };
  const remove = (i: number) => {
    setFiles((prev) => prev.filter((_, j) => j !== i));
    setError(null);
  };

  const problems = files.map(checkFile);
  const firstBad = problems.findIndex(Boolean);
  const problemText =
    firstBad < 0
      ? null
      : problems[firstBad] === "format"
        ? t("import.errFormat", { i: firstBad + 1 })
        : t("import.errSize", {
            i: firstBad + 1,
            mb: (files[firstBad].size / 1048576).toFixed(1).replace(".", lang === "es" ? "," : "."),
          });
  const reading = phase === "reading";
  const canRead = files.length > 0 && firstBad < 0 && phase === "idle";

  async function read() {
    setPhase("reading");
    setError(null);
    try {
      const shots = await Promise.all(files.map(shrinkImage));
      const result = await api.importScreenshots(shots);
      if (!alive.current) return;
      const species = catalog.species.find((s) => s.name === result.species);
      if (!species) throw new ApiError("unknown species", 422, null);
      const form = toImportedForm(result, species, files.length);
      track({
        name: "screenshots_read",
        props: {
          result: form.unread.length ? "partial" : "full",
          images: files.length,
          unread_fields: form.unread.length,
        },
      });
      onImported(form);
    } catch (err) {
      if (!alive.current) return;
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 429) {
        const body = (err as ApiError).body as { resets_at?: string } | null;
        const resets = body?.resets_at ?? null;
        rememberImportLimit(resets);
        setResetsAt(resets);
        setPhase("limit");
        track({ name: "screenshots_read", props: { result: "limit_reached", images: files.length, unread_fields: 0 } });
        return;
      }
      setError(status === 422 ? t("import.errNotRecognized") : t("import.errService"));
      track({
        name: "screenshots_read",
        props: { result: status === 422 ? "not_recognized" : "failed", images: files.length, unread_fields: 0 },
      });
      setPhase("idle");
    }
  }

  if (phase === "limit") {
    const time = resetsAt
      ? new Date(resetsAt).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })
      : "";
    return (
      <Modal title={t("import.title")} onClose={onClose}>
        <div className="import-dialog">
          <p className="placeholder" role="status" style={{ textAlign: "left", padding: 0 }}>
            {t("import.limit", { time })}
            <br />
            {t("import.limitHint")}
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t("import.gotIt")}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const message = problemText ?? error;
  return (
    <Modal title={t("import.title")} onClose={onClose}>
      <div className="import-dialog" aria-busy={reading}>
        <p className="import-dialog__help">{t("import.help")}</p>
        <ShotSlots files={files} problems={problems} busy={reading} onAdd={add} onRemove={remove} />
        {message && (
          <p className="error" role="alert" style={{ margin: 0 }}>
            {message}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className={"btn btn--primary" + (reading ? " btn--reading" : "")}
            disabled={!canRead}
            onClick={read}
          >
            {reading ? t("import.reading") : t("import.read")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
