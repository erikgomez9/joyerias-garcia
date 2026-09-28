import { useEffect, useRef, type ReactNode, type TouchEvent } from "react";
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

const SWIPE_MIN_PX = 48;

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
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

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

  function onTouchStart(e: TouchEvent) {
    const t = e.changedTouches[0];
    if (!t) return;
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  }

  function onTouchEnd(e: TouchEvent) {
    const startX = touchStartX.current;
    const startY = touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (startX == null || startY == null) return;

    const t = e.changedTouches[0];
    if (!t) return;

    const deltaX = t.clientX - startX;
    const deltaY = t.clientY - startY;

    if (Math.abs(deltaX) < SWIPE_MIN_PX) return;
    if (Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX < 0) onNext?.();
    else onPrevious?.();
  }

  if (!open) return null;

  const canSwipe = Boolean(onPrevious || onNext);

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
      <div
        className={styles.frame}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={canSwipe ? onTouchStart : undefined}
        onTouchEnd={canSwipe ? onTouchEnd : undefined}
      >
        {navHint ? <p className={styles.navHint}>{navHint}</p> : null}
        <img className={styles.image} src={src} alt={alt} draggable={false} />
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}
