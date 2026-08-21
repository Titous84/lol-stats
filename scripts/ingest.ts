// Collecteur complet livré en L1 (docs/TASKS.md § L1, docs/ARCHITECTURE.md § 3).
// Ce placeholder ne fait qu'un appel Riot : vérifier que la clé est lue et
// valide, sans consommer de quota au-delà de ce seul appel.
import { config } from "dotenv";

config({ path: ".env.local" });

const REQUIRED_ENV = [
  "RIOT_API_KEY",
  "RIOT_GAME_NAME",
  "RIOT_TAG_LINE",
  "RIOT_PLATFORM",
  "RIOT_REGION",
] as const;

function main(): void {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    console.error(
      `Configuration invalide : variable(s) manquante(s) dans .env.local : ${missing.join(", ")}`,
    );
    process.exitCode = 2;
    return;
  }

  const key = process.env.RIOT_API_KEY!;
  if (key.includes("xxxx")) {
    console.error(
      "RIOT_API_KEY dans .env.local est encore la valeur d'exemple — coller une vraie clé.",
    );
    process.exitCode = 2;
    return;
  }

  console.log(
    `RIOT_API_KEY lue (${key.slice(0, 9)}…, ${key.length} caractères). ` +
      `Compte suivi : ${process.env.RIOT_GAME_NAME}#${process.env.RIOT_TAG_LINE} ` +
      `(${process.env.RIOT_PLATFORM}/${process.env.RIOT_REGION}).`,
  );
  console.log("Collecteur complet (découverte, récupération, snapshot de rang) livré en L1.");
}

main();
