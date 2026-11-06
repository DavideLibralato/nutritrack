// Freccia "indietro" (‹) della testata di Aggiungi. Come le altre icone
// Icona*: tratto in currentColor, quindi prende il colore del testo del
// pulsante che la contiene; aria-hidden, perché il nome lo dà il pulsante.

export default function IconaIndietro() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}
