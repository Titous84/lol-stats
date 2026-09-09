import styles from "./ConfidenceBadge.module.css";

interface ConfidenceBadgeProps {
  label: string;
  trend?: "win" | "loss" | "neutral";
  /** true si l'intervalle de Wilson à 95 % contient la référence (50 %) — rend le swatch haché plutôt que plein. */
  uncertain?: boolean;
}

export function ConfidenceBadge({ label, trend = "neutral", uncertain = false }: ConfidenceBadgeProps) {
  const swatchClasses = [styles.swatch, styles[`swatch--${trend}`], uncertain ? styles["swatch--uncertain"] : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={styles.badge}>
      <span className={swatchClasses} aria-hidden="true" />
      {label}
    </span>
  );
}
