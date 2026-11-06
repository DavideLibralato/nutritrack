// Lente: dentro il campo di ricerca (18 px) e, più grande (40 px), nello
// stato "Nessun risultato". Da 32 px in su il tratto si assottiglia, perché
// a quella misura il tratto da 2 sembrerebbe troppo pesante. Tratto in
// currentColor, aria-hidden.

export default function IconaLente({
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
      strokeWidth={size >= 32 ? 1.6 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
