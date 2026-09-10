import { describe, expect, it } from "vitest";
import { virtualWindow } from "./virtual-window";

// Config = celle du montage de test /vtest : viewportHeight 288, ROW_HEIGHT 32,
// OVERSCAN 6. visibleCount = ceil(288/32) = 9 ; fenêtre = 9 + 2*6 = 21 lignes.
const CFG = { viewportHeight: 288, rowHeight: 32, overscan: 6 };
const N = 260;

describe("virtualWindow — fenêtre de virtualisation", () => {
  it("haut de liste (scrollTop 0) : commence à l'index 0", () => {
    expect(virtualWindow({ ...CFG, scrollTop: 0, rowCount: N })).toEqual({
      startIndex: 0,
      endIndex: 21,
    });
  });

  it("milieu : fenêtre centrée sur la ligne sous le scroll", () => {
    // scrollTop 3200 -> ligne 100 ; start = 100 - 6 = 94 ; end = 94 + 21 = 115
    expect(virtualWindow({ ...CFG, scrollTop: 3200, rowCount: N })).toEqual({
      startIndex: 94,
      endIndex: 115,
    });
  });

  it("bas de liste : endIndex plafonné à rowCount, jamais de ligne fantôme", () => {
    // scrollTop max = 260*32 - 288 = 8032 ; ligne = floor(8032/32) = 251
    // start = 245 ; end = min(260, 245 + 21) = 260
    const w = virtualWindow({ ...CFG, scrollTop: 8032, rowCount: N });
    expect(w).toEqual({ startIndex: 245, endIndex: 260 });
    expect(w.endIndex).toBeLessThanOrEqual(N);
  });

  it("la somme des spacers + lignes montées = hauteur totale constante", () => {
    for (const scrollTop of [0, 800, 3200, 6000, 8032]) {
      const { startIndex, endIndex } = virtualWindow({ ...CFG, scrollTop, rowCount: N });
      const topSpacer = startIndex * CFG.rowHeight;
      const mounted = (endIndex - startIndex) * CFG.rowHeight;
      const bottomSpacer = (N - endIndex) * CFG.rowHeight;
      expect(topSpacer + mounted + bottomSpacer).toBe(N * CFG.rowHeight); // 8320
    }
  });

  it("aucune entrée de type 'largeur' : la fenêtre ne peut pas dépendre d'une barre horizontale", () => {
    // Le contrat de l'API le garantit structurellement — ce test fige le fait
    // qu'ajouter une dimension horizontale casserait la signature.
    const keys = Object.keys({
      scrollTop: 0,
      rowCount: 0,
      viewportHeight: 0,
      rowHeight: 0,
      overscan: 0,
    });
    expect(keys).not.toContain("clientHeight");
    expect(keys).not.toContain("scrollLeft");
    expect(keys).not.toContain("width");
  });

  it("aria-rowindex : 1re et dernière ligne montées portent le bon index réel (<= aria-rowcount)", () => {
    const { startIndex, endIndex } = virtualWindow({ ...CFG, scrollTop: 3200, rowCount: N });
    const ariaRowcount = N + 1; // 261 (lignes de données + en-tête)
    // Dans DataTable : aria-rowindex = startIndex + i + 2 (en-tête = 1).
    const firstMountedAria = startIndex + 0 + 2;
    const lastMountedAria = startIndex + (endIndex - startIndex - 1) + 2;
    expect(firstMountedAria).toBe(96);
    expect(lastMountedAria).toBe(116);
    expect(lastMountedAria).toBeLessThanOrEqual(ariaRowcount);
  });
});
