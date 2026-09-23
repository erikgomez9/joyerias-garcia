import styles from "./ImageLightbox.module.css";

interface Props {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, open, onClose }: Props) {
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
      <img
        className={styles.image}
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
