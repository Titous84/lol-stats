import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "lol-stats",
  description: "Analyse locale des parties League of Legends de TikaSama#DME.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
