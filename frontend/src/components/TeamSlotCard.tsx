import { useState } from "react";
import type { CSSProperties } from "react";
import type { Slot, Member, Catalog, TeamProduction } from "../types";
import { ProductionCard } from "./ProductionCard";
import { configFromMember } from "../pages/Teams";
import { useI18n } from "../i18n";
import { IconClose, IconSplit } from "./icons";

interface TeamSlotCardProps {
  slot: Slot;
  slotIndex: number;
  memberById: Map<string, Member>;
  catalog: Catalog;
  // members[] del resultado del equipo; cada uno con production ya ponderada.
  contributions: TeamProduction["members"] | undefined;
  favBerrySet: Set<string>;
  canSplit: boolean;            // false si el equipo está al máximo de slots o sin pokés libres
  teamHasSplit?: boolean;       // true si algún slot del equipo está dividido (para igualar altura del header)
  onRequestSplit: (slotIndex: number) => void;    // abre el picker en modo "dividir"
  onRemoveSlot: (slotIndex: number) => void;      // quita el slot entero
  onRemoveEntry: (slotIndex: number, entryIndex: number) => void; // colapsa a single
  onWeightChange: (slotIndex: number, pctA: number) => void;      // pctA en 1..99
}

export function TeamSlotCard({
  slot,
  slotIndex,
  memberById,
  catalog,
  contributions,
  favBerrySet,
  canSplit,
  teamHasSplit,
  onRequestSplit,
  onRemoveSlot,
  onRemoveEntry,
  onWeightChange,
}: TeamSlotCardProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState(0);
  const split = slot.entries.length === 2;
  const safeTab = Math.min(activeTab, slot.entries.length - 1);
  const active = slot.entries[safeTab];

  const member = memberById.get(active.memberId);
  const config = member ? configFromMember(catalog, member) : null;
  if (!member || !config) return null;

  const contrib = contributions?.find((mc) => mc.member_id === active.memberId);
  const prod = contrib?.production ?? null;

  const speciesEntry = catalog.species.find((s) => s.name === member.species);
  const isFavoriteBerry =
    speciesEntry != null && favBerrySet.has(speciesEntry.berry);

  const nameOf = (id: string) => memberById.get(id)?.species ?? "?";
  const pctA = Math.round(slot.entries[0].weight * 100);

  const header = split ? (
    <div className="team-slot__split">
      <div className="team-slot__tabs" role="tablist">
        {slot.entries.map((e, i) => (
          <div key={e.memberId} className={"team-slot__tab-wrap" + (i === safeTab ? " team-slot__tab-wrap--active" : "")}>
            <button type="button" role="tab" aria-selected={i === safeTab} className="team-slot__tab" onClick={() => setActiveTab(i)}>
              {nameOf(e.memberId)}{" "}
              <span className="team-slot__tab-pct">{Math.round(e.weight * 100)}%</span>
            </button>
            <button
              type="button"
              className="team-slot__tab-remove"
              onClick={() => onRemoveEntry(slotIndex, i)}
              title={t("teams.splitRemove")}
              aria-label={t("teams.splitRemove") + ": " + nameOf(e.memberId)}
            >
              <IconClose />
            </button>
          </div>
        ))}
      </div>
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
    </div>
  ) : (
    <div className={"team-slot__single" + (teamHasSplit ? " team-slot__single--reserve" : "")}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => onRequestSplit(slotIndex)}
        disabled={!canSplit}
        title={t("teams.split")}
        aria-label={t("teams.split")}
      >
        <IconSplit />
      </button>
      <button
        type="button"
        className="icon-btn prod-card__remove"
        onClick={() => onRemoveSlot(slotIndex)}
        title={t("card.remove")}
        aria-label={t("card.remove")}
      >
        <IconClose />
      </button>
    </div>
  );

  return (
    <ProductionCard
      config={config}
      catalog={catalog}
      production={prod}
      productionError={null}
      readOnly
      isFavoriteBerry={isFavoriteBerry}
      slotHeader={header}
      onEdit={() => {}}
      onClone={() => {}}
      onRemove={() => onRemoveSlot(slotIndex)}
      onMakeBase={() => {}}
      onSaveToBox={() => {}}
    />
  );
}
