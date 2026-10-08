import { useEffect, useRef, useState } from "react";

import {
  EVENT_KINDS, EVENT_KIND_ORDER, SCOPE_SPECIALTIES, SPECIALTY_ICON,
  atBound, formatEffectValue, isComplete, stepValue,
  type EventEffect, type EventEffectKind, type EventScope,
} from "../eventBonus";
import { useI18n } from "../i18n";
import { newId } from "../roster";
import { typeIcon } from "../typeIcons";
import { IconChevronDown, IconClose, IconEdit } from "./icons";
import { Placeholder } from "./Placeholder";

type Draft = Omit<EventEffect, "id">;
const NEW_DRAFT: Draft = { kind: "extra_ingredients", value: 1, scope: { kind: "team" } };

interface Props {
  effects: EventEffect[];
  onChange: (effects: EventEffect[]) => void;
  /** Types present in the catalog, for the type scope picker. */
  types: string[];
}

function ScopeLabel({ scope, scoped }: { scope: EventScope; scoped: boolean }) {
  const { t, type: typeName, specialty } = useI18n();
  if (!scoped) return <span className="effect-row__scope effect-row__scope--none">{t("common.dash")}</span>;
  if (scope.kind === "type" && scope.type)
    return (
      <span className="effect-row__scope">
        <img className="mini-icon type-icon" src={typeIcon(scope.type)} alt="" />
        {typeName(scope.type)}
      </span>
    );
  if (scope.kind === "specialty")
    return (
      <span className="effect-row__scope">
        <img className="mini-icon" src={SPECIALTY_ICON[scope.specialty]} alt="" />
        {specialty(scope.specialty)}
      </span>
    );
  return <span className="effect-row__scope">{t("event.scope.team")}</span>;
}

export function EventTab({ effects, onChange, types }: Props) {
  const { t, lang } = useI18n();
  // null = no editor; "new" = adding; otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(NEW_DRAFT);

  const kindLabel = (k: EventEffectKind) => t(EVENT_KINDS[k].labelKey);

  const open = (target: EventEffect | null) => {
    setEditing(target ? target.id : "new");
    setDraft(target ? { kind: target.kind, value: target.value, scope: target.scope } : NEW_DRAFT);
  };
  const confirm = () => {
    if (editing === "new") onChange([...effects, { id: newId(), ...draft }]);
    else onChange(effects.map((e) => (e.id === editing ? { id: e.id, ...draft } : e)));
    setEditing(null);
  };

  return (
    <div className="island-tab event-tab">
      {effects.length === 0 ? (
        <Placeholder>{t("event.empty")}</Placeholder>
      ) : (
        <ul className="effect-list">
          {effects.map((e) => (
            <li key={e.id} className="effect-row">
              <span className="effect-row__name">
                <img className="mini-icon" src={EVENT_KINDS[e.kind].icon} alt="" />
                {kindLabel(e.kind)}
                <span className="metric-mark metric-mark--good">
                  {formatEffectValue(e.kind, e.value, lang)}
                </span>
              </span>
              <ScopeLabel scope={e.scope} scoped={EVENT_KINDS[e.kind].scoped} />
              <span className="effect-row__actions">
                <button type="button" className="icon-btn" onClick={() => open(e)}
                  title={t("event.editAria", { effect: kindLabel(e.kind) })}
                  aria-label={t("event.editAria", { effect: kindLabel(e.kind) })}>
                  <IconEdit aria-hidden="true" />
                </button>
                <button type="button" className="icon-btn"
                  onClick={() => {
                    if (editing === e.id) setEditing(null);
                    onChange(effects.filter((x) => x.id !== e.id));
                  }}
                  title={t("event.removeAria", { effect: kindLabel(e.kind) })}
                  aria-label={t("event.removeAria", { effect: kindLabel(e.kind) })}>
                  <IconClose aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {editing === null ? (
        <div className="effect-list__actions">
          <button type="button" className="btn btn--ghost" onClick={() => open(null)}>
            {t("event.add")}
          </button>
          {effects.length > 0 && (
            <button type="button" className="btn btn--ghost" onClick={() => onChange([])}>
              {t("event.removeAll")}
            </button>
          )}
        </div>
      ) : (
        <EffectEditor
          draft={draft}
          setDraft={setDraft}
          types={types}
          isNew={editing === "new"}
          onCancel={() => setEditing(null)}
          onConfirm={confirm}
        />
      )}
    </div>
  );
}

// Close an open popover on outside mousedown or Escape (as IslandTab does).
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

interface EditorProps {
  draft: Draft;
  setDraft: (d: Draft) => void;
  types: string[];
  isNew: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function EffectEditor({ draft, setDraft, types, isNew, onCancel, onConfirm }: EditorProps) {
  const { t, lang, type: typeName, specialty } = useI18n();
  const [kindOpen, setKindOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const spec = EVENT_KINDS[draft.kind];
  const kindRef = useDismiss(kindOpen, () => setKindOpen(false));
  const typeRef = useDismiss(typeOpen, () => setTypeOpen(false));

  const pickKind = (kind: EventEffectKind) => {
    setDraft({ kind, value: EVENT_KINDS[kind].initial, scope: EVENT_KINDS[kind].scoped ? draft.scope : { kind: "team" } });
    setKindOpen(false);
  };
  const scopeKind = draft.scope.kind;
  const setScopeKind = (k: EventScope["kind"]) =>
    setDraft({
      ...draft,
      scope: k === "team" ? { kind: "team" } : k === "type" ? { kind: "type", type: null } : { kind: "specialty", specialty: "Ingredients" },
    });

  return (
    <div className="inline-editor">
      <div className="island-tab__row">
        <span className="island-tab__label">{t("event.effect")}</span>
        <div className="filter-control" ref={kindRef}>
          <button type="button" className={"filter-btn" + (kindOpen ? " filter-btn--open" : "")}
            aria-haspopup="listbox" aria-expanded={kindOpen} onClick={() => setKindOpen((o) => !o)}>
            <span className="filter-btn__value">
              <img className="mini-icon" src={spec.icon} alt="" />
              {t(spec.labelKey)}
            </span>
            <IconChevronDown className="filter-btn__chevron" />
          </button>
          {kindOpen && (
            <div className="filter-pop" role="listbox" aria-label={t("event.effect")}>
              <div className="filter-list">
                {EVENT_KIND_ORDER.map((k) => (
                  <button key={k} type="button" role="option" aria-selected={k === draft.kind}
                    className={"filter-list__item" + (k === draft.kind ? " is-selected" : "")}
                    onClick={() => pickKind(k)}>
                    <img className="mini-icon" src={EVENT_KINDS[k].icon} alt="" />
                    <span className="filter-list__label">{t(EVENT_KINDS[k].labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="island-tab__row">
        <span className="island-tab__label">{t("event.value")}</span>
        <div className="level-stepper">
          <button type="button" className="level-stepper__btn" aria-label="−"
            disabled={atBound(draft.kind, draft.value, -1)}
            onClick={() => setDraft({ ...draft, value: stepValue(draft.kind, draft.value, -1) })}>−</button>
          <input type="text" className="level-stepper__input inline-editor__value" readOnly
            value={formatEffectValue(draft.kind, draft.value, lang)} aria-label={t("event.value")} />
          <button type="button" className="level-stepper__btn" aria-label="+"
            disabled={atBound(draft.kind, draft.value, 1)}
            onClick={() => setDraft({ ...draft, value: stepValue(draft.kind, draft.value, 1) })}>+</button>
        </div>
      </div>

      {spec.scoped && (
        <>
          <div className="island-tab__row">
            <span className="island-tab__label">{t("event.scope")}</span>
            <div className="specialty-toggle" role="group" aria-label={t("event.scope")}>
              {(["team", "type", "specialty"] as const).map((k) => (
                <button key={k} type="button" aria-pressed={scopeKind === k}
                  className={"specialty-toggle__btn" + (scopeKind === k ? " is-on" : "")}
                  onClick={() => setScopeKind(k)}>
                  {t(`event.scope.${k}`)}
                </button>
              ))}
            </div>
          </div>
          {draft.scope.kind === "type" && (
            <div className="island-tab__row">
              <span className="island-tab__label" />
              <div className="filter-control" ref={typeRef}>
                <button type="button" className={"filter-btn" + (typeOpen ? " filter-btn--open" : "")}
                  aria-haspopup="listbox" aria-expanded={typeOpen} onClick={() => setTypeOpen((o) => !o)}>
                  <span className="filter-btn__value">
                    {draft.scope.type ? (
                      <>
                        <img className="mini-icon type-icon" src={typeIcon(draft.scope.type)} alt="" />
                        {typeName(draft.scope.type)}
                      </>
                    ) : (
                      <span className="filter-btn__placeholder">{t("event.pickType")}</span>
                    )}
                  </span>
                  <IconChevronDown className="filter-btn__chevron" />
                </button>
                {typeOpen && (
                  <div className="filter-pop">
                    <div className="filter-grid" role="listbox" aria-label={t("event.scope.type")}>
                      {types.map((tp) => {
                        const selected = draft.scope.kind === "type" && draft.scope.type === tp;
                        return (
                          <button key={tp} type="button" role="option" aria-selected={selected}
                            className={"filter-grid__item" + (selected ? " is-selected" : "")}
                            onClick={() => { setDraft({ ...draft, scope: { kind: "type", type: tp } }); setTypeOpen(false); }}>
                            <img className="mini-icon type-icon" src={typeIcon(tp)} alt="" />
                            <span className="filter-grid__label">{typeName(tp)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {draft.scope.kind === "specialty" && (
            <div className="island-tab__row">
              <span className="island-tab__label" />
              <div className="specialty-toggle" role="group" aria-label={t("event.scope.specialty")}>
                {SCOPE_SPECIALTIES.map((sp) => {
                  const on = draft.scope.kind === "specialty" && draft.scope.specialty === sp;
                  return (
                    <button key={sp} type="button" aria-pressed={on}
                      className={"specialty-toggle__btn" + (on ? " is-on" : "")}
                      onClick={() => setDraft({ ...draft, scope: { kind: "specialty", specialty: sp } })}>
                      <img className="mini-icon inline-editor__btn-icon" src={SPECIALTY_ICON[sp]} alt="" />
                      {specialty(sp)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <div className="inline-editor__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>{t("common.cancel")}</button>
        <button type="button" className="btn btn--primary" disabled={!isComplete(draft)} onClick={onConfirm}>
          {isNew ? t("event.confirmAdd") : t("event.confirmSave")}
        </button>
      </div>
    </div>
  );
}
