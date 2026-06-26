// Ícono de listón usando las imágenes oficiales del juego. El índice 0 (sin listón)
// se muestra en gris y atenuado. Lo usan el selector del formulario y las cards.
import { ribbonIcon } from "../ribbons";

interface Props {
  index: number;
  size?: number;
  title?: string;
}

export function RibbonIcon({ index, size = 28, title }: Props) {
  const empty = index <= 0;
  return (
    <img
      className={"ribbon-icon" + (empty ? " ribbon-icon--empty" : "")}
      src={ribbonIcon(index)}
      width={size}
      height={size}
      alt={title ?? ""}
      title={title}
      loading="lazy"
    />
  );
}
