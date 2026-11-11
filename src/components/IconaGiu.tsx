// Freccia in giù: accanto al titolo di Aggiungi (18 px) dice che il nome
// del pasto si tocca per sceglierne un altro; più piccola nei menu a
// tendina di Impostazioni > Alimenti (16 px) e nella pastiglia
// Normale/Allenamento di Oggi (12 px). Tratto in currentColor, aria-hidden.

export default function IconaGiu({ className, size = 18 }: { className?: string; size?: number }) {
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
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
