// Il cancelletto: "Scrivi il codice" nella schermata di scansione.
// Tratto in currentColor, aria-hidden: il testo o l'aria-label del
// pulsante dice già cosa fa. Dal mockup docs/mockups/aggiungi.html.

export default function IconaCancelletto({
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
      <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
    </svg>
  );
}
