// "+": aggiunge (sulle righe di Aggiungi, 22 px) e crea (nel pulsante in
// fondo, 18 px). Tratto in currentColor, aria-hidden.

export default function IconaPiu({
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
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
