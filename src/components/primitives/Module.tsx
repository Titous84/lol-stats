import type { ReactNode } from "react";
import styles from "./Module.module.css";

interface ModuleProps {
  title?: string;
  meta?: string;
  density?: "default" | "compact";
  children: ReactNode;
  className?: string;
}

/**
 * Carte + filet — l'unité de base du canvas d'analyse (CLAUDE.md § 2.3).
 * L'élévation vient du filet 1px, jamais d'un écart de luminance ou d'ombre.
 */
export function Module({ title, meta, density = "default", children, className }: ModuleProps) {
  const classes = [styles.module, density === "compact" ? styles["module--compact"] : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={className ? `${classes} ${className}` : classes}>
      {(title || meta) && (
        <header className={styles.header}>
          {title && <h3 className={styles.title}>{title}</h3>}
          {meta && <span className={styles.meta}>{meta}</span>}
        </header>
      )}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
