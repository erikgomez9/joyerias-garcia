import { useEffect, type ReactNode } from "react";
import styles from "./ImageLightbox.module.css";

interface Props {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
  /** Texto o precios bajo la imagen ampliada */
  footer?: ReactNode;
  onPrevious?: () => void;
  onNext?: () => void;
  navHint?: string;
}

export function ImageLightbox({
  src,
  alt,
  open,
  onClose,
  footer,
  onPrevious,
  onNext,
  navHint,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrevious?.();
      if (e.key === "ArrowRight") onNext?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onPrevious, onNext]);

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
      {onPrevious ? (
        <button
          type="button"
          className={`${styles.nav} ${styles.navPrev}`}
          aria-label="Pieza anterior"
          onClick={(e) => {
            e.stopPropagation();
            onPrevious();
          }}
        >
          ‹
        </button>
      ) : null}
      {onNext ? (
        <button
          type="button"
          className={`${styles.nav} ${styles.navNext}`}
          aria-label="Pieza siguiente"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
        >
          ›
        </button>
      ) : null}
      <div className={styles.frame} onClick={(e) => e.stopPropagation()}>
        {navHint ? <p className={styles.navHint}>{navHint}</p> : null}
        <img className={styles.image} src={src} alt={alt} />
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}
