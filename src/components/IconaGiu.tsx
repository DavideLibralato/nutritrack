// Freccia in giù accanto al titolo di Aggiungi: dice che il nome del pasto
// si tocca per sceglierne un altro. Tratto in currentColor, aria-hidden.

export default function IconaGiu({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
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
