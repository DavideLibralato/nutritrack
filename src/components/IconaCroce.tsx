// "×" per svuotare il campo di ricerca di Aggiungi. Tratto in currentColor,
// così eredita il grigio del pulsante (text-muted); aria-hidden.

export default function IconaCroce({ className }: { className?: string }) {
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
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
