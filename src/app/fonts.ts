import { Archivo, Inter, JetBrains_Mono } from "next/font/google";

/**
 * Archivo Expanded n'est pas une famille séparée dans Google Fonts : c'est
 * la police variable Archivo sur son axe `wdth` au maximum (125 = "expanded").
 * L'axe variable oblige à charger `weight: "variable"` (tout l'axe wght) ;
 * seules les graisses 600/700 sont utilisées côté CSS pour le rôle display
 * (CLAUDE.md § 2.2), via `font-weight` — la largeur via `font-stretch: expanded`.
 */
export const archivoExpanded = Archivo({
  subsets: ["latin"],
  weight: "variable",
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
