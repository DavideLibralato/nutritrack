// Freccia "avanti" (›), la gemella di IconaIndietro: la freccia del periodo
// successivo in Statistiche e i link «Apri il giorno», «Registra peso».
// Tratto in currentColor; aria-hidden, perché il nome lo dà chi la contiene.

export default function IconaAvanti({ dimensione = 20 }: { dimensione?: number }) {
  return (
    <svg
      width={dimensione}
      height={dimensione}
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
