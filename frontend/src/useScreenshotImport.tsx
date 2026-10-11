import { useState, type ReactNode } from "react";

import { useGate } from "./auth/useGate";
import { ImportDialog } from "./components/ImportDialog";
import type { Catalog, ImportedForm } from "./types";

/** The "+ Desde imágenes" flow: sign-in gate → dialog → a pre-filled form for the caller. */
export function useScreenshotImport(catalog: Catalog | undefined) {
  const { guard } = useGate();
  const [open, setOpen] = useState(false);
  const [imported, setImported] = useState<ImportedForm | null>(null);
  const start = () => guard(() => setOpen(true), "import_screenshots");
  const dialog: ReactNode =
    open && catalog ? (
      <ImportDialog
        catalog={catalog}
        onClose={() => setOpen(false)}
        onImported={(form) => {
          setOpen(false);
          setImported(form);
        }}
      />
    ) : null;
  return { start, dialog, imported, clear: () => setImported(null) };
}
