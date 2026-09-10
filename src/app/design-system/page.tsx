"use client";

import { useState } from "react";
import {
  Module,
  StatTile,
  DataTable,
  ModuleSkeleton,
  EmptyState,
  ErrorState,
  ConfidenceBadge,
  type DataTableColumn,
} from "@/components/primitives";
import styles from "./page.module.css";

const NEUTRALS = [
  { token: "--void", hex: "#0B0F17", meaning: "Fond de page" },
  { token: "--surface", hex: "#141A26", meaning: "Panneaux, cartes, lignes de tableau" },
  { token: "--raised", hex: "#1E2736", meaning: "Survol, ligne active, popovers" },
  { token: "--line", hex: "#232C3C", meaning: "Filets 1px, grilles, séparateurs" },
  { token: "--mist", hex: "#98A3B5", meaning: "Texte secondaire, libellés d'axes" },
  { token: "--frost", hex: "#E6EAF2", meaning: "Texte primaire, chiffres saillants" },
];

const ACCENTS = [
  { token: "--self", hex: "#E9B64C", meaning: "Identité : « moi ». Rien d'autre." },
  { token: "--rival", hex: "#A88FF5", meaning: "L'adversaire — toujours + hachure" },
  { token: "--win", hex: "#45C08D", meaning: "Écart agrégé au-dessus de la référence" },
  { token: "--loss", hex: "#E8837A", meaning: "Écart agrégé en dessous de la référence" },
  { token: "--side-blue", hex: "#5AA2F0", meaning: "Côté bleu — module « côté » uniquement" },
  { token: "--side-red", hex: "#F0655A", meaning: "Côté rouge — module « côté » uniquement" },
  { token: "--focus", hex: "#E6EAF2", meaning: "Anneau de focus clavier uniquement" },
];

interface MatchRow {
  id: string;
  duration: string;
  champion: string;
  role: string;
  won: boolean;
  kda: string;
  aggregateDelta: number;
}

const MATCH_ROWS: MatchRow[] = [
  { id: "NA1_5021384210", duration: "28:41", champion: "Ahri", role: "MID", won: true, kda: "8/2/5", aggregateDelta: 6.4 },
  { id: "NA1_5021379884", duration: "34:12", champion: "Jinx", role: "ADC", won: true, kda: "11/3/6", aggregateDelta: 6.4 },
  { id: "NA1_5021371002", duration: "22:05", champion: "Lee Sin", role: "JUNGLE", won: false, kda: "3/6/4", aggregateDelta: -3.1 },
  { id: "NA1_5021365577", duration: "31:47", champion: "Thresh", role: "SUPPORT", won: true, kda: "1/2/14", aggregateDelta: 2.8 },
  { id: "NA1_5021358190", duration: "26:33", champion: "Ahri", role: "MID", won: false, kda: "4/5/3", aggregateDelta: 6.4 },
  { id: "NA1_5021349921", duration: "39:58", champion: "Malphite", role: "TOP", won: true, kda: "5/1/9", aggregateDelta: -1.2 },
  { id: "NA1_5021341440", duration: "24:19", champion: "Jinx", role: "ADC", won: true, kda: "9/1/7", aggregateDelta: 6.4 },
  { id: "NA1_5021333087", duration: "29:52", champion: "Lee Sin", role: "JUNGLE", won: true, kda: "6/3/8", aggregateDelta: -3.1 },
];

const MATCH_COLUMNS: DataTableColumn<MatchRow>[] = [
  { key: "id", header: "Partie", width: "160px", mono: true, render: (r) => r.id },
  { key: "duration", header: "Durée", width: "80px", mono: true, align: "right", render: (r) => r.duration },
  { key: "champion", header: "Champion", width: "120px", render: (r) => r.champion },
  { key: "role", header: "Rôle", width: "90px", render: (r) => r.role },
  {
    key: "result",
    header: "Résultat",
    width: "80px",
    align: "right",
    render: (r) => <span className={`${styles.pastille} ${r.won ? styles["pastille--win"] : styles["pastille--loss"]}`} aria-label={r.won ? "Victoire" : "Défaite"} />,
  },
  { key: "kda", header: "KDA", width: "90px", align: "right", render: (r) => r.kda },
  {
    key: "aggregateDelta",
    header: "Delta agrégé",
    width: "110px",
    align: "right",
    render: (r) => (
      <span className={r.aggregateDelta >= 0 ? styles["deltaCell--win"] : styles["deltaCell--loss"]}>
        {r.aggregateDelta >= 0 ? "+" : ""}
        {r.aggregateDelta.toFixed(1)}%
      </span>
    ),
  },
];

export default function DesignSystemPage() {
  const [kpiTick, setKpiTick] = useState(0);
  const [flashTick, setFlashTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tableEmpty, setTableEmpty] = useState(false);

  const changedCells =
    flashTick > 0 ? new Set(["NA1_5021384210:kda", "NA1_5021379884:aggregateDelta"]) : undefined;

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Système de design — La Faille</h1>
        <p className={styles.pageSubtitle}>
          Fondations visuelles du lot L5 : tokens, primitives et échelle de densité. Aucune donnée
          de partie réelle ici — cette page ne fait aucune requête sur la base.
        </p>
      </header>

      <section className={styles.section} aria-labelledby="colors-title">
        <h2 className={styles.sectionTitle} id="colors-title">
          Couleurs — neutres
        </h2>
        <div className={styles.swatchGrid}>
          {NEUTRALS.map((s) => (
            <div className={styles.swatchCard} key={s.token}>
              <div className={styles.swatchColor} style={{ background: `var(${s.token})` }} />
              <div className={styles.swatchInfo}>
                <span className={styles.swatchToken}>{s.token}</span>
                <span className={styles.swatchHex}>{s.hex}</span>
                <span className={styles.swatchMeaning}>{s.meaning}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="accents-title">
        <h2 className={styles.sectionTitle} id="accents-title">
          Couleurs — accents sémantiques
        </h2>
        <p className={styles.sectionNote}>
          Chaque accent a un sens unique et un seul (CLAUDE.md § 2.1). Aucun n&apos;est réutilisé
          hors de son rôle déclaré.
        </p>
        <div className={styles.swatchGrid}>
          {ACCENTS.map((s) => (
            <div className={styles.swatchCard} key={s.token}>
              <div className={styles.swatchColor} style={{ background: `var(${s.token})` }} />
              <div className={styles.swatchInfo}>
                <span className={styles.swatchToken}>{s.token}</span>
                <span className={styles.swatchHex}>{s.hex}</span>
                <span className={styles.swatchMeaning}>{s.meaning}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="diverge-title">
        <h2 className={styles.sectionTitle} id="diverge-title">
          Échelle divergente
        </h2>
        <p className={styles.sectionNote}>
          Réservée aux écarts agrégés (heatmaps de winrate, deltas), centrée sur la référence —
          jamais sur un résultat de partie individuelle.
        </p>
        <div className={styles.divergeBar} />
        <div className={styles.divergeLabels}>
          <span>--loss (0%)</span>
          <span>référence (50%)</span>
          <span>--win (100%)</span>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="type-title">
        <h2 className={styles.sectionTitle} id="type-title">
          Typographie
        </h2>
        <div className={styles.typeGrid}>
          <div className={styles.typeSpecimen}>
            <span className={styles.typeLabel}>Display — Archivo Expanded 700</span>
            <span className={styles["typeSample--display"]}>Winrate par champion</span>
          </div>
          <div className={styles.typeSpecimen}>
            <span className={styles.typeLabel}>Texte / UI — Inter 400–600</span>
            <span className={styles["typeSample--text"]}>
              47 victoires sur 82 parties classées en Solo/Duo, saison en cours.
            </span>
          </div>
          <div className={styles.typeSpecimen}>
            <span className={styles.typeLabel}>Identifiants — JetBrains Mono</span>
            <span className={styles["typeSample--mono"]}>NA1_5021384210 · 15.16 · 28:41</span>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="density-title">
        <h2 className={styles.sectionTitle} id="density-title">
          Échelle de densité
        </h2>
        <div className={styles.densityDemo}>
          <div className={styles.densityRow}>Ligne de tableau — 32px de hauteur</div>
          <div className={styles.densityRow}>Padding interne de module — 12 à 16px</div>
          <div className={styles.densityRow}>Gouttière entre modules — 16px</div>
        </div>
        <div className={styles.densityLegend}>
          <span>--row-height: 32px</span>
          <span>--module-gutter: 16px</span>
          <span>--module-padding: 12–16px</span>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="module-title">
        <h2 className={styles.sectionTitle} id="module-title">
          Primitive — Module
        </h2>
        <div className={styles.moduleGrid}>
          <Module title="Densité par défaut" meta="16px">
            <p className={styles["typeSample--text"]}>Padding standard, pour la majorité des modules du canvas.</p>
          </Module>
          <Module title="Densité compacte" meta="12px" density="compact">
            <p className={styles["typeSample--text"]}>Réservée aux modules à forte densité d&apos;information.</p>
          </Module>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="tile-title">
        <h2 className={styles.sectionTitle} id="tile-title">
          Primitive — StatTile
        </h2>
        <p className={styles.sectionNote}>
          Le tween de valeur est réservé aux KPI d&apos;en-tête (§ 2.5). Le bouton simule un
          changement de filtre.
        </p>
        <div className={styles.controlRow}>
          <button type="button" className={styles.button} onClick={() => setKpiTick((t) => t + 1)}>
            Simuler un changement de filtre
          </button>
        </div>
        <div className={styles.tileGrid}>
          <StatTile key={`wr-${kpiTick}`} label="Winrate" value="57.3%" delta="+4.2%" trend="win" changed={kpiTick > 0} />
          <StatTile key={`kda-${kpiTick}`} label="KDA moyen" value="3.8" delta="-0.2" trend="loss" changed={kpiTick > 0} />
          <StatTile key={`games-${kpiTick}`} label="Parties" value="82" changed={kpiTick > 0} />
          <StatTile key={`dur-${kpiTick}`} label="Durée moyenne" value="29:14" changed={kpiTick > 0} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="table-title">
        <h2 className={styles.sectionTitle} id="table-title">
          Primitive — DataTable
        </h2>
        <p className={styles.sectionNote}>
          Résultat unitaire encodé par la forme (pastille pleine/évidée, § 2.1 règle 3), delta
          agrégé encodé par la couleur. Au-delà de 200 lignes, seules les lignes visibles sont
          montées.
        </p>
        <div className={styles.controlRow}>
          <button type="button" className={styles.button} onClick={() => setFlashTick((t) => t + 1)}>
            Simuler une mise à jour (flash 400ms)
          </button>
          <button type="button" className={styles.buttonSecondary} onClick={() => setTableEmpty((e) => !e)}>
            {tableEmpty ? "Afficher les lignes" : "Voir l'état vide"}
          </button>
        </div>
        <DataTable
          columns={MATCH_COLUMNS}
          rows={tableEmpty ? [] : MATCH_ROWS}
          getRowId={(r) => r.id}
          label="Parties récentes (démo)"
          viewportHeight={288}
          changedCells={changedCells}
          emptyMessage="Aucune partie pour ce filtre."
        />
      </section>

      <section className={styles.section} aria-labelledby="states-title">
        <h2 className={styles.sectionTitle} id="states-title">
          Primitives — chargement, vide, erreur
        </h2>
        <div className={styles.controlRow}>
          <button type="button" className={styles.buttonSecondary} onClick={() => setLoading((l) => !l)}>
            {loading ? "Afficher le contenu chargé" : "Afficher le squelette"}
          </button>
        </div>
        <div className={styles.stateGrid}>
          {loading ? (
            <ModuleSkeleton rows={3} />
          ) : (
            <Module title="Winrate par rôle" meta="82 parties">
              <p className={styles["typeSample--text"]}>Contenu chargé — remplace le squelette ci-dessus.</p>
            </Module>
          )}
          <EmptyState message="Aucune partie ne correspond à ce filtre. Élargis la plage de dates ou change de file." />
          <ErrorState
            message="Impossible de charger ce module. La dernière ingestion a peut-être échoué."
            actionLabel="Réessayer"
            onAction={() => {}}
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="confidence-title">
        <h2 className={styles.sectionTitle} id="confidence-title">
          Primitive — ConfidenceBadge
        </h2>
        <p className={styles.sectionNote}>
          Hachure = l&apos;intervalle de Wilson à 95 % contient la référence : l&apos;incertitude
          statistique reste visible plutôt que masquée.
        </p>
        <div className={styles.badgeRow}>
          <ConfidenceBadge label="Ahri — 61% (42 parties)" trend="win" />
          <ConfidenceBadge label="Malphite — 44% (18 parties)" trend="loss" />
          <ConfidenceBadge label="Lee Sin — 52% (5 parties)" trend="neutral" uncertain />
          <ConfidenceBadge label="Thresh — 58% (7 parties)" trend="win" uncertain />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="focus-title">
        <h2 className={styles.sectionTitle} id="focus-title">
          Focus clavier
        </h2>
        <p className={styles.sectionNote}>
          Navigue au Tab : l&apos;anneau est toujours --frost, jamais un accent sémantique.
        </p>
        <div className={styles.focusRow}>
          <a className={styles.focusLink} href="#colors-title">
            Lien vers Couleurs
          </a>
          <button type="button" className={styles.buttonSecondary}>
            Bouton secondaire
          </button>
          <button type="button" className={styles.button}>
            Bouton primaire
          </button>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="motion-title">
        <h2 className={styles.sectionTitle} id="motion-title">
          Mouvement
        </h2>
        <p className={styles.sectionNote}>
          Stagger d&apos;entrée au premier montage uniquement, ≤ 300ms au total. Active
          « Réduire les animations » dans le système pour vérifier que tout bascule à 0ms.
        </p>
        <div className={styles.staggerGrid}>
          {Array.from({ length: 6 }, (_, i) => (
            <div className={styles.staggerItem} style={{ "--stagger-index": i } as React.CSSProperties} key={i} />
          ))}
        </div>
      </section>
    </main>
  );
}
