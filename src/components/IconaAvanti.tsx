// Freccia "avanti" (›), la gemella di IconaIndietro: la freccia del periodo
// successivo in Statistiche e in Oggi, i link «Apri il giorno», «Registra
// peso», e la freccia di «Apri «nome»» nella scheda di un alimento del
// catalogo (lì con shrink-0, perché il nome accanto si accorcia e la freccia
// no). Tratto in currentColor; aria-hidden, perché il nome lo dà chi la
// contiene.

export default function IconaAvanti({
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
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
