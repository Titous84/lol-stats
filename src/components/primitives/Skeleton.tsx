import styles from "./Skeleton.module.css";

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

/** Bloc de base — jamais un spinner. La forme calque toujours l'élément final. */
export function Skeleton({ width = "100%", height = "16px", className }: SkeletonProps) {
  const classes = className ? `${styles.skeleton} ${className}` : styles.skeleton;
  return <div className={classes} style={{ width, height }} aria-hidden="true" />;
}

interface ModuleSkeletonProps {
  rows?: number;
}

/** Calque la forme d'un Module rempli : en-tête + N lignes de contenu, mêmes gouttières. */
export function ModuleSkeleton({ rows = 3 }: ModuleSkeletonProps) {
  return (
    <div className={styles.module} role="status" aria-label="Chargement">
      <Skeleton width="40%" height="13px" />
      {Array.from({ length: rows }, (_, i) => (
        <div className={styles.moduleRow} key={i}>
          <Skeleton width="100%" height="32px" />
        </div>
      ))}
    </div>
  );
}
