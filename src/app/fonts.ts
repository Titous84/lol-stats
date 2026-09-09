import { Archivo, Inter, JetBrains_Mono } from "next/font/google";

/**
 * Archivo Expanded n'est pas une famille séparée : c'est la police variable
 * Archivo, axe `wdth` (62–125, défaut 100) poussé au max via `font-stretch`.
 * `axes: ["wdth"]` embarque cet axe dans le fichier auto-hébergé — sans lui,
 * seul `wght` est téléchargé et `font-stretch: expanded` serait inerte.
 * `weight` est omis : pour une police variable, next/font résout tout l'axe
 * `wght` (100–900) tout seul (doc : "If loading a variable font, you don't
 * need to specify the font weight"). Côté CSS : `font-stretch: expanded` pour
 * la largeur, `font-weight: 600/700` pour le rôle display (CLAUDE.md § 2.2).
 */
export const archivoExpanded = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo-expanded",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const fontVariables = `${archivoExpanded.variable} ${inter.variable} ${jetbrainsMono.variable}`;
