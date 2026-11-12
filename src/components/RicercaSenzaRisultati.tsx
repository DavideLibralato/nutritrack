// Lo stato vuoto di una ricerca che non trova niente, in Impostazioni >
// Alimenti (scheda «I miei» e scheda «Catalogo»): la lente grande, una riga
// in evidenza e una in grigio (mockup docs/mockups/alimenti-aspetto.html,
// classe .vuoto: lente da 40, 8 px fra le righe, 28 px sopra e 24 ai lati).
// Aggiungi ha il suo, con il riquadro «Nel catalogo» vicino.

import IconaLente from "@/components/IconaLente";

export default function RicercaSenzaRisultati({
  titolo,
  testo,
}: {
  titolo: string;
  testo: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 pt-7 text-center">
      <IconaLente className="text-muted" size={40} />
      <p className="font-medium">{titolo}</p>
      <p className="text-sm leading-relaxed text-muted">{testo}</p>
    </div>
  );
}
