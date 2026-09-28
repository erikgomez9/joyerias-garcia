import type { ReactNode } from "react";
import styles from "./ImageLightbox.module.css";

interface Props {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
  /** Texto o precios bajo la imagen ampliada */
  footer?: ReactNode;
}

export function ImageLightbox({ src, alt, open, onClose, footer }: Props) {
  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Vista ampliada"
      onClick={onClose}
    >
      <button type="button" className={styles.close} onClick={onClose}>
        Cerrar
      </button>
      <div className={styles.frame} onClick={(e) => e.stopPropagation()}>
        <img className={styles.image} src={src} alt={alt} />
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}
