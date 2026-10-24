// Il marchio di Libra: la bilancia e la parola "Libra" (pagine di accesso,
// mockup docs/mockups/testata-login.html, proposta 3 "Nel titolo";
// PUNTO_DI_PARTENZA.md §7, "Nome e icona").
//
// La bilancia è lo stesso disegno dell'icona dell'app
// (docs/mockups/icona-libra.html), ridisegnata con tratti più spessi e
// senza il quadrato scuro, perché stia alta come le maiuscole di "Libra".
// Non si prende dai PNG di public/icons: hanno il fondo scuro e un colore
// fisso, mentre qui il colore è currentColor e segue l'accento scelto in
// Aspetto e il tema (text-accent = var(--accento)).
//
// Le misure sono in em: il marchio prende la grandezza dal testo intorno.
// Lo stesso componente fa il marchio grande dentro un titolo e quello
// piccolo in cima alla pagina.
//
// Due varianti:
// - "titolo" (Accedi, Registrati): bilancia e parola in accento;
// - "piccolo" (in cima alle altre pagine): solo la bilancia in accento, la
//   parola nel colore del testo.
//
// role="img" con aria-label: lo screen reader dice "Libra" una volta sola,
// e dentro un titolo legge "Accedi a Libra".
//
// Il disegno sta in src/lib/glifoBilancia.ts, condiviso con l'animazione
// di apertura.

import {
  ASTA,
  BASE,
  FILI_DESTRA,
  FILI_SINISTRA,
  GIOGO,
  PERNO,
  PIATTO_DESTRA,
  PIATTO_SINISTRA,
  SPESSORE_ASTA,
  SPESSORE_BASE,
  SPESSORE_FILI,
  SPESSORE_GIOGO,
  VIEWBOX_BILANCIA,
} from "@/lib/glifoBilancia";

export default function MarchioLibra({ variante }: { variante: "titolo" | "piccolo" }) {
  return (
    <span
      role="img"
      aria-label="Libra"
      className={`inline-flex items-center gap-[0.32em] font-display font-bold leading-none tracking-[-0.015em] ${
        variante === "titolo" ? "text-accent" : "text-foreground"
      }`}
    >
      <svg
        viewBox={VIEWBOX_BILANCIA}
        aria-hidden="true"
        className="h-[0.78em] w-auto shrink-0 -translate-y-[0.02em] text-accent"
      >
        <g fill="currentColor" stroke="currentColor" strokeLinecap="round">
          <circle {...PERNO} stroke="none" />
          <path d={ASTA} strokeWidth={SPESSORE_ASTA} fill="none" />
          <path d={BASE} strokeWidth={SPESSORE_BASE} fill="none" />
          <path d={GIOGO} strokeWidth={SPESSORE_GIOGO} fill="none" />
          <path d={`${FILI_SINISTRA} ${FILI_DESTRA}`} strokeWidth={SPESSORE_FILI} fill="none" />
          <path d={`${PIATTO_SINISTRA} ${PIATTO_DESTRA}`} stroke="none" />
        </g>
      </svg>
      <span aria-hidden="true">Libra</span>
    </span>
  );
}
