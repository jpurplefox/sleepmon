import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";

import { useI18n } from "../i18n";
import type { Slot } from "../teamRoster";
import { weightsOf } from "../teamRoster";
import type { BerryRole, Catalog, TeamProduction, WeeklyBonus } from "../types";
import type { SaveStatus } from "../useSaveToBox";
import { ProductionCard } from "./ProductionCard";
import { IconClose, IconEdit, IconSaveBox, IconSplit } from "./icons";

interface TeamSlotCardProps {
  slot: Slot;
  slotIndex: number;
  catalog: Catalog;
  // members[] from the team result; each production is already weighted.
  contributions: TeamProduction["members"] | undefined;
  berryRoleOf: (berry: string) => BerryRole;
  expert: boolean;
  weeklyBonus: WeeklyBonus;
  teamHasSplit?: boolean;
  saveStatus: (entryId: string) => SaveStatus;
  onAddNew: (slotIndex: number) => void;
  onAddFromBox: (slotIndex: number) => void;
  onEdit: (slotIndex: number, entryIndex: number) => void;
  onSaveToBox: (slotIndex: number, entryIndex: number) => void;
  onRemoveSlot: (slotIndex: number) => void;
  onRemoveEntry: (slotIndex: number, entryIndex: number) => void;
  onWeightChange: (slotIndex: number, pctA: number) => void;
}

export function TeamSlotCard({
  slot,
  slotIndex,
  catalog,
  contributions,
  berryRoleOf,
  expert,
  weeklyBonus,
  teamHasSplit,
  saveStatus,
  onAddNew,
  onAddFromBox,
  onEdit,
  onSaveToBox,
  onRemoveSlot,
  onRemoveEntry,
  onWeightChange,
}: TeamSlotCardProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuListRef = useRef<HTMLDivElement>(null);
  const splitBtnRef = useRef<HTMLButtonElement>(null);

  const split = slot.entries.length === 2;
  const safeTab = Math.min(activeTab, slot.entries.length - 1);
  const active = slot.entries[safeTab];
  const status = saveStatus(active.id);

  // Click outside and Escape close the split menu; focus returns to the trigger —
  // same pattern as ProfileMenu and BoxToolbar.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        splitBtnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Arrow-key navigation for the split menu (docs/design-system.md, "Dropdown /
  // combobox pattern"). Enter needs no handling: a focused <button> already
  // activates on Enter.
  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(
      menuListRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const delta = e.key === "ArrowDown" ? 1 : -1;
    const next = (current + delta + items.length) % items.length;
    items[next]?.focus();
  };

  const speciesEntry = catalog.species.find((s) => s.name === active.config.species);
  const berryRole: BerryRole = speciesEntry ? berryRoleOf(speciesEntry.berry) : "none";
  const contrib = contributions?.find((mc) => mc.id === active.id);
  const prod = contrib?.production ?? null;

  const editBtn = (entryIndex: number, species: string) => (
    <button
      type="button"
      className="icon-btn"
      onClick={() => onEdit(slotIndex, entryIndex)}
      title={t("teams.editNamed", { species })}
      aria-label={t("teams.editNamed", { species })}
    >
      <IconEdit />
    </button>
  );

  const saveBtn = (entryIndex: number, species: string, inBox: boolean, saving: boolean) => (
    <button
      type="button"
      className={
        "icon-btn" + (inBox ? " icon-btn--inbox" : "") + (saving ? " icon-btn--saving" : "")
      }
      disabled={saving}
      onClick={() => onSaveToBox(slotIndex, entryIndex)}
      title={t(inBox ? "teams.saveNamedUpdate" : "teams.saveNamed", { species })}
      aria-label={t(inBox ? "teams.saveNamedUpdate" : "teams.saveNamed", { species })}
    >
      <IconSaveBox />
    </button>
  );

  const removeSlotBtn = (
    <button
      type="button"
      className="icon-btn prod-card__remove"
      onClick={() => onRemoveSlot(slotIndex)}
      title={t("card.remove")}
      aria-label={t("card.remove")}
    >
      <IconClose />
    </button>
  );

  // "Split" has to ask where the second Pokémon comes from: the same two paths
  // the add cell offers, in a menu anchored to the button.
  const splitControl = (
    <div className="team-slot__split-host" ref={menuRef}>
      <button
        type="button"
        ref={splitBtnRef}
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
        title={t("teams.split")}
        aria-label={t("teams.split")}
      >
        <IconSplit />
      </button>
      {menuOpen && (
        <div className="filter-pop team-slot__split-pop">
          <div
            ref={menuListRef}
            className="filter-list"
            role="menu"
            aria-label={t("teams.addFrom")}
            onKeyDown={onMenuKeyDown}
          >
            <button
              type="button"
              role="menuitem"
              className="filter-list__item"
              onClick={() => {
                setMenuOpen(false);
                onAddNew(slotIndex);
              }}
            >
              {t("prod.new")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="filter-list__item"
              onClick={() => {
                setMenuOpen(false);
                onAddFromBox(slotIndex);
              }}
            >
              {t("prod.myPokemon")}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const pctA = Math.round(slot.share * 100);
  const weights = weightsOf(slot);

  const header = split ? (
    <div className="team-slot__split">
      <div className="team-slot__tabs" role="tablist">
        {slot.entries.map((e, i) => (
          <div
            key={e.id}
            className={
              "team-slot__tab-wrap" + (i === safeTab ? " team-slot__tab-wrap--active" : "")
            }
          >
            <button
              type="button"
              role="tab"
              aria-selected={i === safeTab}
              className="team-slot__tab"
              onClick={() => setActiveTab(i)}
            >
              {e.config.species}{" "}
              <span className="team-slot__tab-pct">{Math.round(weights[i] * 100)}%</span>
            </button>
            <button
              type="button"
              className="team-slot__tab-remove"
              onClick={() => onRemoveEntry(slotIndex, i)}
              title={t("teams.splitRemove")}
              aria-label={t("teams.splitRemove") + ": " + e.config.species}
            >
              <IconClose />
            </button>
          </div>
        ))}
      </div>
      {/* The tabs row is the one that wraps, so the per-Pokémon actions ride with
          the slider instead — see docs/design-system.md, "A split slot's actions
          ride with the slider". */}
      <div className="team-slot__weights">
        <div
          className="bonus-slider team-slot__slider team-slot__slider--split"
          style={{ "--ratio": (pctA / 100).toFixed(4) } as CSSProperties}
        >
          <div className="bonus-slider__row">
            <div className="bonus-slider__track">
              <div className="bonus-slider__fill" />
              <div className="bonus-slider__thumb" />
              <input
                type="range"
                className="bonus-slider__input"
                min={1}
                max={99}
                step={1}
                value={pctA}
                onChange={(e) => onWeightChange(slotIndex, Number(e.target.value))}
                aria-label={t("teams.splitShare")}
                aria-valuetext={`${pctA}%`}
              />
            </div>
          </div>
        </div>
        <div className="team-slot__weights-actions">
          {editBtn(safeTab, active.config.species)}
          {saveBtn(
            safeTab,
            active.config.species,
            active.sourceId !== undefined,
            status.state === "saving",
          )}
          {removeSlotBtn}
        </div>
      </div>
    </div>
  ) : (
    <div className={"team-slot__single" + (teamHasSplit ? " team-slot__single--reserve" : "")}>
      {editBtn(0, active.config.species)}
      {saveBtn(0, active.config.species, active.sourceId !== undefined, status.state === "saving")}
      {splitControl}
      {removeSlotBtn}
    </div>
  );

  return (
    <ProductionCard
      config={active.config}
      catalog={catalog}
      production={prod}
      productionError={null}
      readOnly
      berryRole={berryRole}
      expert={expert}
      weeklyBonus={weeklyBonus}
      slotHeader={header}
      notice={
        status.state === "error" ? (
          <p className="error" role="alert">
            {status.error ?? t("card.saveError")}
          </p>
        ) : status.state === "saved" ? (
          <p className="muted" role="status" aria-live="polite">
            {t("card.saved")}
          </p>
        ) : null
      }
      onEdit={() => {}}
      onClone={() => {}}
      onRemove={() => onRemoveSlot(slotIndex)}
      onMakeBase={() => {}}
      onSaveToBox={() => {}}
    />
  );
}
