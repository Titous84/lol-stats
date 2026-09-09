"use client";

import { useMemo, useRef, useState, type ReactNode, type UIEvent } from "react";
import styles from "./DataTable.module.css";

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
  /** Hauteur de la fenêtre de défilement en pixels. Au-delà de 200 lignes, seules les lignes visibles sont montées. */
  viewportHeight?: number;
  /** Clés `${rowId}:${columnKey}` dont la valeur vient de changer — déclenche le flash de surlignage (§ 2.5) au lieu d'un tween. */
  changedCells?: Set<string>;
  emptyMessage?: string;
}

const ROW_HEIGHT = 32;
const OVERSCAN = 6;
const VIRTUALIZE_THRESHOLD = 200;

export function DataTable<T>({
  columns,
  rows,
  getRowId,
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
    const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT);
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(rows.length, start + visibleCount + OVERSCAN * 2);
    return { startIndex: start, endIndex: end };
  }, [scrollTop, rows.length, shouldVirtualize, viewportHeight]);

  const visibleRows = rows.slice(startIndex, endIndex);
  const topSpacer = startIndex * ROW_HEIGHT;
  const bottomSpacer = (rows.length - endIndex) * ROW_HEIGHT;

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    if (shouldVirtualize) {
      setScrollTop(event.currentTarget.scrollTop);
    }
  }

  return (
    <div className={styles.wrapper} role="table">
      <div className={styles.headerRow} role="row">
        {columns.map((column) => (
          <div
            key={column.key}
            role="columnheader"
            className={column.align === "right" ? `${styles.headerCell} ${styles["headerCell--right"]}` : styles.headerCell}
            style={{ width: column.width }}
          >
            {column.header}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className={styles.emptyRow} role="row">
          {emptyMessage}
        </div>
      ) : (
        <div
          ref={viewportRef}
          className={styles.viewport}
          style={{ maxHeight: viewportHeight }}
          onScroll={handleScroll}
          role="rowgroup"
        >
          {shouldVirtualize && <div className={styles.spacer} style={{ height: topSpacer }} />}
          {visibleRows.map((row) => {
            const rowId = getRowId(row);
            return (
              <div className={styles.row} role="row" key={rowId}>
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
                    <div key={column.key} role="cell" className={classes} style={{ width: column.width }}>
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
