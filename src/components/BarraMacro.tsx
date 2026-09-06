// Una riga macro della fascia alta di Oggi: nome a sinistra, "valore / target
// g" a destra, barra di avanzamento sotto. Tre di queste affiancate
// all'anello (Proteine, Carboidrati, Grassi).
//
// Colore della barra (sezione 7 / "Le barre macro", corretto rispetto al
// mockup dove erano blu/arancio/rosso): il colore entra solo quando dice
// qualcosa.
//   - neutro scuro: sotto il target
//   - accento: target raggiunto
//   - avviso: target superato
// Attenzione: per i macro "verde" è *arrivare* al target, l'opposto delle
// calorie dove "verde" è restare sotto. La regola comune è "verde = stai
// andando come volevi, arancio = hai superato".

interface Props {
  nome: string;
  valore: number;
  obiettivo: number | null;
}

export default function BarraMacro({ nome, valore, obiettivo }: Props) {
  const valoreArr = Math.round(valore);
  const target = obiettivo != null ? Math.round(obiettivo) : null;

  const frazione = target && target > 0 ? Math.min(valoreArr / target, 1) : 0;

  let classeRiempimento = "bg-foreground";
  if (target != null && target > 0) {
    if (valoreArr > target) classeRiempimento = "bg-warning";
    else if (valoreArr >= target) classeRiempimento = "bg-accent";
  }

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span>{nome}</span>
        <span>{target != null ? `${valoreArr} / ${target} g` : `${valoreArr} g`}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full ${classeRiempimento}`}
          style={{ width: `${frazione * 100}%` }}
        />
      </div>
    </div>
  );
}
