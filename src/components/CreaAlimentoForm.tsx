"use client";

// Creazione a mano di un alimento, quando la ricerca nel catalogo locale non
// lo trova (PUNTO_DI_PARTENZA.md, sezione 3: "un modo per crearlo a mano").
// I valori sono per 100 g (sezione 9.3), più la porzione predefinita in
// grammi che poi lo sheet quantità userà come default.
//
// L'alimento creato entra nel catalogo con fonte "manuale" e
// verificato = false (sezione 4 / 10.8: un alimento verificato non si
// modifica, se ne crea uno nuovo). Da qui si passa subito allo sheet
// quantità per aggiungerlo al diario.

import { useState } from "react";
import { repositoryAlimenti } from "@/lib/repository";
import type { Alimento } from "@/lib/db/tipi";

const CLASSE_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface Props {
  userId: string;
  nomeIniziale: string;
  onAnnulla: () => void;
  onCreato: (alimento: Alimento) => void;
}

export default function CreaAlimentoForm({
  userId,
  nomeIniziale,
  onAnnulla,
  onCreato,
}: Props) {
  const [nome, setNome] = useState(nomeIniziale);
  const [kcal, setKcal] = useState("");
  const [proteine, setProteine] = useState("");
  const [carboidrati, setCarboidrati] = useState("");
  const [grassi, setGrassi] = useState("");
  const [porzione, setPorzione] = useState("100");
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);

    const num = (s: string) => Number(s.replace(",", "."));
    const kcalN = num(kcal);
    const proteineN = num(proteine);
    const carboidratiN = num(carboidrati);
    const grassiN = num(grassi);
    const porzioneN = num(porzione);

    if (!nome.trim()) {
      setErrore("Dai un nome all'alimento.");
      return;
    }
    if (
      [kcal, proteine, carboidrati, grassi].some((v) => v.trim() === "") ||
      [kcalN, proteineN, carboidratiN, grassiN].some(
        (n) => Number.isNaN(n) || n < 0
      )
    ) {
      setErrore("Calorie e macro devono essere numeri validi (anche 0).");
      return;
    }
    if (porzione.trim() === "" || Number.isNaN(porzioneN) || porzioneN <= 0) {
      setErrore("La porzione predefinita deve essere un numero di grammi maggiore di 0.");
      return;
    }

    setInCorso(true);
    try {
      const alimento = await repositoryAlimenti.crea({
        user_id: userId,
        nome: nome.trim(),
        marca: null,
        barcode: null,
        kcal_100g: kcalN,
        proteine_100g: proteineN,
        carboidrati_100g: carboidratiN,
        grassi_100g: grassiN,
        zuccheri_100g: null,
        fibre_100g: null,
        saturi_100g: null,
        sale_100g: null,
        porzione_default_g: porzioneN,
        fonte: "manuale",
        verificato: false,
      });
      onCreato(alimento);
    } catch {
      setInCorso(false);
      setErrore("Non è stato possibile salvare l'alimento. Riprova.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Nuovo alimento</h2>
        <button
          type="button"
          onClick={onAnnulla}
          className={`rounded text-sm text-muted underline ${CLASSE_FOCUS}`}
        >
          Torna alla ricerca
        </button>
      </div>

      <div>
        <label htmlFor="crea-nome" className="block text-sm font-medium mb-1">
          Nome
        </label>
        <input
          id="crea-nome"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
        />
      </div>

      <p className="text-xs uppercase tracking-wide text-muted">Valori per 100 g</p>
      <div className="space-y-3">
        <CampoNumero id="crea-kcal" etichetta="Calorie (kcal)" valore={kcal} onChange={setKcal} />
        <CampoNumero
          id="crea-proteine"
          etichetta="Proteine (g)"
          valore={proteine}
          onChange={setProteine}
        />
        <CampoNumero
          id="crea-carboidrati"
          etichetta="Carboidrati (g)"
          valore={carboidrati}
          onChange={setCarboidrati}
        />
        <CampoNumero id="crea-grassi" etichetta="Grassi (g)" valore={grassi} onChange={setGrassi} />
      </div>

      <div>
        <label htmlFor="crea-porzione" className="block text-sm font-medium mb-1">
          Porzione predefinita (g)
        </label>
        <input
          id="crea-porzione"
          type="text"
          inputMode="decimal"
          value={porzione}
          onChange={(e) => setPorzione(e.target.value)}
          className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
        />
        <p className="text-xs text-muted mt-1">
          È il valore già pronto nello sheet quantità: scegli quello che pesi più spesso.
        </p>
      </div>

      {errore && <p className="text-sm text-warning">{errore}</p>}

      <button
        type="submit"
        disabled={inCorso}
        className={`w-full rounded-lg bg-accent p-2 font-medium text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
      >
        {inCorso ? "Salvataggio..." : "Crea e scegli la quantità"}
      </button>
    </form>
  );
}

function CampoNumero(props: {
  id: string;
  etichetta: string;
  valore: string;
  onChange: (valore: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={props.id} className="text-sm">
        {props.etichetta}
      </label>
      <input
        id={props.id}
        type="text"
        inputMode="decimal"
        value={props.valore}
        onChange={(e) => props.onChange(e.target.value)}
        className={`w-28 rounded-lg border border-border p-2 text-right ${CLASSE_FOCUS}`}
      />
    </div>
  );
}
