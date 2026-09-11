"use client";

import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type UIEvent,
} from "react";
import styles from "./DataTable.module.css";
import { virtualWindow } from "./virtual-window";
import { EmptyState } from "./EmptyState";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  width: string;
  align?: "left" | "right";
  mono?: boolean;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string | number;
  /** Nom accessible du tableau — role="table" et zone de défilement clavier. */
  label?: string;
  /** Hauteur de la fenêtre de défilement en pixels. Au-delà de 200 lignes, seules les lignes visibles sont montées. */
  viewportHeight?: number;
  /** Clés `${rowId}:${columnKey}` dont la valeur vient de changer — déclenche le flash de surlignage (§ 2.5) au lieu d'un tween. */
  changedCells?: Set<string>;
  emptyMessage?: string;
}

/**
 * Miroir JS de --row-height (tokens.css, 32px). La virtualisation calcule en
 * JS les hauteurs de spacer et les pas de défilement clavier — ces maths ont
 * besoin d'un nombre, pas d'une CSS var (indisponible au SSR). Couplage
 * volontaire : toute modif de --row-height doit être répercutée ici.
 */
const ROW_HEIGHT = 32;
const OVERSCAN = 6;
const VIRTUALIZE_THRESHOLD = 200;

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  label,
  viewportHeight = 320,
  changedCells,
  emptyMessage = "Aucune ligne pour ce filtre.",
}: DataTableProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const shouldVirtualize = rows.length > VIRTUALIZE_THRESHOLD;

  const { startIndex, endIndex } = useMemo(() => {
    if (!shouldVirtualize) {
      return { startIndex: 0, endIndex: rows.length };
    }
    return virtualWindow({
      scrollTop,
      rowCount: rows.length,
      viewportHeight,
      rowHeight: ROW_HEIGHT,
      overscan: OVERSCAN,
    });
  }, [scrollTop, rows.length, shouldVirtualize, viewportHeight]);

  const visibleRows = rows.slice(startIndex, endIndex);
  const topSpacer = startIndex * ROW_HEIGHT;
  const bottomSpacer = (rows.length - endIndex) * ROW_HEIGHT;

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    if (shouldVirtualize) {
      setScrollTop(event.currentTarget.scrollTop);
    }
  }

  // Défilement clavier de la zone de données (WCAG 2.1.1). Écrire scrollTop
  // déclenche l'événement `scroll` -> handleScroll -> la virtualisation monte
  // les lignes qui entrent dans la fenêtre (même chemin que le scroll souris).
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const el = viewportRef.current;
    if (!el) return;
    const page = Math.max(el.clientHeight - ROW_HEIGHT, ROW_HEIGHT);
    let handled = true;
    switch (event.key) {
      case "ArrowDown":
        el.scrollTop += ROW_HEIGHT;
        break;
      case "ArrowUp":
        el.scrollTop -= ROW_HEIGHT;
        break;
      case "PageDown":
        el.scrollTop += page;
        break;
      case "PageUp":
        el.scrollTop -= page;
        break;
      case "Home":
        el.scrollTop = 0;
        break;
      case "End":
        el.scrollTop = el.scrollHeight;
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  }

  return (
    <div
      className={styles.wrapper}
      role="table"
      aria-label={label}
      aria-rowcount={rows.length === 0 ? 2 : rows.length + 1}
    >
      <div className={styles.headerRow} role="row" aria-rowindex={1}>
        {columns.map((column) => (
          <div
            key={column.key}
            role="columnheader"
            className={column.align === "right" ? `${styles.headerCell} ${styles["headerCell--right"]}` : styles.headerCell}
            style={{ width: column.width, minWidth: column.width }}
          >
            {column.header}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className={styles.emptyRow} role="row" aria-rowindex={2}>
          <div role="cell" aria-colindex={1} className={styles.emptyCell}>
            <EmptyState message={emptyMessage} />
          </div>
        </div>
      ) : (
        <div
          ref={viewportRef}
          className={styles.viewport}
          style={{ maxHeight: viewportHeight }}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          role="rowgroup"
          tabIndex={0}
          aria-label={label ? `${label} — données défilables` : "Données du tableau, défilables"}
        >
          {shouldVirtualize && <div className={styles.spacer} style={{ height: topSpacer }} />}
          {visibleRows.map((row, i) => {
            const rowId = getRowId(row);
            return (
              <div className={styles.row} role="row" key={rowId} aria-rowindex={startIndex + i + 2}>
                {columns.map((column) => {
                  const flash = changedCells?.has(`${rowId}:${column.key}`);
                  const classes = [
                    styles.cell,
                    column.align === "right" ? styles["cell--right"] : "",
                    column.mono ? styles["cell--mono"] : "",
                    flash ? styles["cell--flash"] : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <div key={column.key} role="cell" className={classes} style={{ width: column.width, minWidth: column.width }}>
                      {column.render(row)}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {shouldVirtualize && <div className={styles.spacer} style={{ height: bottomSpacer }} />}
        </div>
      )}
    </div>
  );
}
