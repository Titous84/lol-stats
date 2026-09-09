import styles from "./StatTile.module.css";

interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
  trend?: "win" | "loss" | "neutral";
  /** true pendant un seul cycle de rendu suivant un changement de filtre — déclenche le tween (§ 2.5, KPI d'en-tête uniquement). */
  changed?: boolean;
}

export function StatTile({ label, value, delta, trend = "neutral", changed = false }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <span className={styles.label}>{label}</span>
      <div className={styles.valueRow}>
        <span className={changed ? `${styles.value} ${styles["value--changed"]}` : styles.value}>
          {value}
        </span>
        {delta && <span className={`${styles.delta} ${styles[`delta--${trend}`]}`}>{delta}</span>}
      </div>
    </div>
  );
}
