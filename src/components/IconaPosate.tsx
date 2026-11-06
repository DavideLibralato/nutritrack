// Posate (forchetta e cucchiaio) dello stato vuoto di Aggiungi, quando non
// ci sono ancora Recenti né Preferiti. Tratto in currentColor, aria-hidden.

export default function IconaPosate({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 3v7a3 3 0 0 0 6 0V3M9 10v11M17 3c-1.5 1.7-2 3.4-2 5.5S15.5 12.5 17 14v7" />
    </svg>
  );
}
