// "i" in un cerchio: l'avviso in cima a "Nuovo alimento" quando i valori
// vengono da Open Food Facts (mockup docs/mockups/aggiungi.html, "Valori
// da Open Food Facts"). Tratto in currentColor, aria-hidden: il testo
// accanto dice già tutto.

export default function IconaInfo({
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
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5v.01" />
    </svg>
  );
}
