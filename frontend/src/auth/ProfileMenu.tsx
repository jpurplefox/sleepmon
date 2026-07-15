import { useEffect, useRef, useState } from "react";

import { IconSignOut } from "../components/icons";
import { useI18n } from "../i18n";
import { useAuth } from "./AuthContext";

// Iniciales del nombre para el avatar sin foto (mismo vocabulario que
// `.mini-icon--empty`: un placeholder neutro, no un error).
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

// Menú de cuenta en la topbar (signed in). Trigger `.avatar-btn` (foto de Google
// o iniciales); panel reusa el esqueleto de dropdown (`.filter-pop` +
// `.filter-list__item`) con header de cuenta + "Cerrar sesión". Click afuera +
// Escape cierran; el foco vuelve al trigger — mismo patrón que FilterPopover.
export function ProfileMenu() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [photoBroken, setPhotoBroken] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const showPhoto = Boolean(user.avatar_url) && !photoBroken;

  return (
    <div className="profile-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={"avatar-btn" + (open ? " is-open" : "")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("auth.accountAria", { name: user.display_name })}
        onClick={() => setOpen((o) => !o)}
      >
        {showPhoto ? (
          <img src={user.avatar_url ?? ""} alt="" onError={() => setPhotoBroken(true)} />
        ) : (
          initials(user.display_name)
        )}
      </button>
      {open && (
        <div className="filter-pop" role="menu">
          <div className="profile-head">
            <div className="avatar-lg">
              {showPhoto ? <img src={user.avatar_url ?? ""} alt="" /> : initials(user.display_name)}
            </div>
            <div>
              <div className="profile-head__name">{user.display_name}</div>
              <div className="profile-head__mail">{user.email}</div>
            </div>
          </div>
          <div className="filter-list__sep" />
          <button
            type="button"
            role="menuitem"
            className="filter-list__item"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            <IconSignOut />
            {t("auth.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
