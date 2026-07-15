import { Modal } from "../components/Modal";
import { useI18n } from "../i18n";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { useGate } from "./useGate";

// Diálogo compartido que cualquier acción reservada (guardar en la Caja, abrir el
// picker, entrar a Análisis de equipo) dispara vía `useGate().guard`. Al
// completar el sign-in, `useGate` reanuda la acción pendiente y cierra el
// diálogo por su cuenta — el usuario vuelve exactamente a donde estaba. Sin
// botón secundario: Escape / la ✕ / click en el fondo son el "ahora no".
export function SignInDialog() {
  const { dialogOpen, closeDialog } = useGate();
  const { t } = useI18n();

  if (!dialogOpen) return null;

  return (
    <Modal title={t("auth.dialogTitle")} onClose={closeDialog}>
      <p>{t("auth.dialogBody")}</p>
      <div className="modal-actions modal-actions--center">
        <GoogleSignInButton />
      </div>
    </Modal>
  );
}
