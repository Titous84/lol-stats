import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** État « rien à montrer » — filet en pointillés, glyphe atténué. Neutre, jamais un accent sémantique. */
export function EmptyState({ message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className={styles.state}>
      <div className={styles.glyph} aria-hidden="true" />
      <p className={styles.message}>{message}</p>
      {actionLabel && onAction && (
        <button type="button" className={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
