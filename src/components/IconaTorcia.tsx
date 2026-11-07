// La torcia: accende la luce della fotocamera, se il telefono lo permette.
// Tratto in currentColor, aria-hidden: il testo o l'aria-label del
// pulsante dice già cosa fa. Dal mockup docs/mockups/aggiungi.html.

export default function IconaTorcia({
  className,
  size = 20,
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
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6c0 2-2 2-2 4v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10c0-2-2-2-2-4V2h12zM6 6h12M12 12v1" />
    </svg>
  );
}
