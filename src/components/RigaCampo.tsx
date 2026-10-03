// Una riga di un GruppoImpostazioni con un campo dentro (decisione B,
// PUNTO_DI_PARTENZA.md sezione 3, "Impostazioni"): etichetta a sinistra,
// campo allineato a destra con l'unità accanto ("2500 kcal", "180 cm"), e
// sotto, se il valore è cambiato e non ancora salvato, "Prima: …".
//
// Il campo ha lo sfondo della pagina (bg-background): dentro il gruppo
// bianco è una casella crema da riempire, come negli sheet. text-base
// (16 px): sotto quella misura Safari su iOS ingrandisce la pagina quando il
// campo prende il fuoco. type="text" con inputMode: su iPhone apre il
// tastierino numerico, e la virgola decimale si accetta (numeroDaCampo).
// Mentre il campo ha il fuoco la tab bar e la barra Salva si nascondono
// (regola in globals.css), come in tutte le altre pagine.

import ValorePrecedente from "./ValorePrecedente";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

export default function RigaCampo({
  id,
  etichetta,
  valore,
  unita,
  decimali = false,
  precedente,
  cambiato = false,
  onChange,
}: {
  id: string;
  etichetta: string;
  valore: string;
  unita?: string;
  decimali?: boolean;
  precedente?: string;
  cambiato?: boolean;
  onChange: (valore: string) => void;
}) {
  return (
    <div className="riga-impostazioni relative px-4 py-2.5">
      <div className="flex min-h-8 items-center gap-3">
        <label htmlFor={id} className="min-w-0 flex-1 text-base">
          {etichetta}
        </label>
        <input
          id={id}
          type="text"
          inputMode={decimali ? "decimal" : "numeric"}
          value={valore}
          onChange={(e) => onChange(e.target.value)}
          className={`w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-base ${CLASSE_FOCUS}`}
        />
        {unita && <span className="w-8 shrink-0 text-[15px] text-muted">{unita}</span>}
      </div>
      {precedente !== undefined && (
        <div className="text-right">
          <ValorePrecedente visibile={cambiato} valore={precedente} />
        </div>
      )}
    </div>
  );
}
