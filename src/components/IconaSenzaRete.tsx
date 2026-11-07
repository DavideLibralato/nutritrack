// Il segnale barrato: la riga "Senza connessione la scansione non è disponibile".
// Tratto in currentColor, aria-hidden: il testo o l'aria-label del
// pulsante dice già cosa fa. Dal mockup docs/mockups/aggiungi.html.

export default function IconaSenzaRete({
  className,
  size = 18,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.1-1.6M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 11.1 5M12 20h.01" />
    </svg>
  );
}
