import { useState } from "react";
import { ImageLightbox } from "@/components/ImageLightbox";
import styles from "./ProductThumb.module.css";

interface Props {
  src: string;
  alt: string;
  size?: "sm" | "md";
}

export function ProductThumb({ src, alt, size = "sm" }: Props) {
  const [zoom, setZoom] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`${styles.thumb} ${size === "md" ? styles.md : ""}`}
        onClick={() => setZoom(true)}
        aria-label={`Ampliar foto de ${alt}`}
        title="Clic para ampliar"
      >
        <img src={src} alt="" loading="lazy" />
      </button>
      <ImageLightbox
        src={src}
        alt={alt}
        open={zoom}
        onClose={() => setZoom(false)}
      />
    </>
  );
}
