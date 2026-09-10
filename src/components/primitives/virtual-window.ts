/**
 * Fenêtre de lignes à monter pour la virtualisation verticale de DataTable.
 *
 * Ne dépend QUE de `scrollTop` (offset vertical du viewport) et de constantes —
 * jamais d'une hauteur mesurée (`clientHeight`). Une barre de défilement
 * horizontale sur le conteneur parent, ou tout autre changement de largeur,
 * est donc sans effet sur la fenêtre calculée.
 */
export interface VirtualWindowInput {
  /** Offset vertical courant du viewport, en px. */
  scrollTop: number;
  /** Nombre total de lignes de données. */
  rowCount: number;
  /** Hauteur de la fenêtre de défilement, en px (prop, pas une mesure DOM). */
  viewportHeight: number;
  /** Hauteur d'une ligne, en px. */
  rowHeight: number;
  /** Lignes montées en plus de part et d'autre de la zone visible. */
  overscan: number;
}

export function virtualWindow({
  scrollTop,
  rowCount,
  viewportHeight,
  rowHeight,
  overscan,
}: VirtualWindowInput): { startIndex: number; endIndex: number } {
  const visibleCount = Math.ceil(viewportHeight / rowHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(rowCount, startIndex + visibleCount + overscan * 2);
  return { startIndex, endIndex };
}
