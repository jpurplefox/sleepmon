import { useI18n } from "../i18n";
import type { EventEffect } from "../eventBonus";
import { EventTab } from "./EventTab";
import { Modal } from "./Modal";

interface Props {
  eventEffects: EventEffect[];
  onEventEffects: (e: EventEffect[]) => void;
  /** Catalog types offered by the event scope picker. */
  eventTypes: string[];
  onClose: () => void;
}

export function EventModal({ eventEffects, onEventEffects, eventTypes, onClose }: Props) {
  const { t } = useI18n();
  return (
    <Modal title={t("teams.tabEvent")} onClose={onClose} wide>
      <EventTab effects={eventEffects} onChange={onEventEffects} types={eventTypes} />
    </Modal>
  );
}
