// Una riga dei target giornalieri in Profilo (Calorie, Grassi, Carboidrati,
// Proteine): etichetta a sinistra, numero a destra, e sotto il valore di
// prima se è cambiato. text-base (16 px): sotto quella misura Safari su iOS
// ingrandisce la pagina quando il campo prende il fuoco.

import { CLASSE_FOCUS } from "@/lib/classeFocus";
import ValorePrecedente from "./ValorePrecedente";

export default function CampoTarget(props: {
  id: string;
  etichetta: string;
  valore: string;
  precedente: string;
  cambiato: boolean;
  onChange: (valore: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={props.id} className="text-sm">
          {props.etichetta}
        </label>
        <input
          id={props.id}
          type="number"
          inputMode="numeric"
          min={0}
          value={props.valore}
          onChange={(e) => props.onChange(e.target.value)}
          className={`w-28 rounded-lg border border-border bg-background p-2 text-right text-base ${CLASSE_FOCUS}`}
        />
      </div>
      <div className="text-right">
        <ValorePrecedente visibile={props.cambiato} valore={props.precedente} />
      </div>
    </div>
  );
}
