import { useEffect, useMemo, useRef } from "react";

import { useI18n } from "../i18n";
import { MAX_SHOTS, type FileProblem } from "../screenshotImport";
import { IconClose } from "./icons";

interface Props {
  files: File[];
  problems: (FileProblem | null)[];
  busy: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (i: number) => void;
}

/** A fixed row of screenshot tiles: filled ones with a remove badge, the first empty one adds. */
export function ShotSlots({ files, problems, busy, onAdd, onRemove }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const accept = (list: FileList | null) => {
    if (list && list.length > 0 && !busy) onAdd(Array.from(list));
  };

  return (
    <div
      className={"shot-slots" + (busy ? " shot-slots--busy" : "")}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        accept(e.dataTransfer.files);
      }}
    >
      {Array.from({ length: MAX_SHOTS }, (_, i) => {
        if (i < files.length) {
          return (
            <div key={i} className={"shot" + (problems[i] ? " shot--bad" : "")}>
              <img src={urls[i]} alt="" />
              {!busy && (
                <button
                  type="button"
                  className="shot__x"
                  aria-label={t("import.remove", { i: i + 1 })}
                  onClick={() => onRemove(i)}
                >
                  <IconClose />
                </button>
              )}
            </div>
          );
        }
        if (i === files.length) {
          return (
            <button
              key={i}
              type="button"
              className="shot shot--empty"
              aria-label={t("import.add")}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              +
            </button>
          );
        }
        return <div key={i} className="shot shot--empty" aria-hidden="true" />;
      })}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(e) => {
          accept(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
