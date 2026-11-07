// Il codice a barre nel mirino: il pulsante Scansiona accanto alla ricerca di Aggiungi.
// Tratto in currentColor, aria-hidden: il testo o l'aria-label del
// pulsante dice già cosa fa. Dal mockup docs/mockups/aggiungi.html.

export default function IconaCodiceBarre({
  className,
  size = 22,
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
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13.5 8v8M17 8v8" />
    </svg>
  );
}
