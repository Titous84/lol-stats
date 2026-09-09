import styles from "./ErrorState.module.css";

interface ErrorStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** État d'échec — se distingue d'EmptyState par le poids (filet plein, fond --raised), jamais par une couleur d'accent. */
export function ErrorState({ message, actionLabel = "Réessayer", onAction }: ErrorStateProps) {
  return (
    <div className={styles.state} role="alert">
      <div className={styles.glyph} aria-hidden="true">
        <span className={styles.glyphMark}>!</span>
      </div>
      <p className={styles.message}>{message}</p>
      {onAction && (
        <button type="button" className={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
