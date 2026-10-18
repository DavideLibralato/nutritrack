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
        viewBox="10 18 80 62"
        aria-hidden="true"
        className="h-[0.78em] w-auto shrink-0 -translate-y-[0.02em] text-accent"
      >
        <g fill="currentColor" stroke="currentColor" strokeLinecap="round">
          <circle cx="50" cy="25" r="5.5" stroke="none" />
          <path d="M50 29 V73" strokeWidth="7" fill="none" />
          <path d="M33 75 H67" strokeWidth="8" fill="none" />
          <path d="M21 34 H79" strokeWidth="7" fill="none" />
          <path d="M22 35 L14 55 M22 35 L30 55 M78 35 L70 55 M78 35 L86 55" strokeWidth="3.5" fill="none" />
          <path d="M12 55 H32 A10 8 0 0 1 12 55 Z M68 55 H88 A10 8 0 0 1 68 55 Z" stroke="none" />
        </g>
      </svg>
      <span aria-hidden="true">Libra</span>
    </span>
  );
}
