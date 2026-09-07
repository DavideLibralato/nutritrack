"use client";

// Creazione a mano di un alimento, quando la ricerca nel catalogo locale non
// lo trova (PUNTO_DI_PARTENZA.md, sezione 3: "un modo per crearlo a mano").
// I valori sono per 100 g (sezione 9.3), più la porzione predefinita in
// grammi che poi lo sheet quantità userà come default.
//
// Lo stesso form serve anche a **modificare** un alimento del catalogo, ma
// solo se creato dall'utente e non ancora verificato (sezione 10.8: un
// alimento verificato non si modifica, se ne crea uno nuovo; quelli
// condivisi non si toccano — vale anche a livello RLS). In quel caso il
// chiamante passa `alimentoDaModificare`: i campi partono dai valori reali,
// il salvataggio fa aggiorna() sulla stessa riga, e compare l'eliminazione
// (logica, deleted_at) con la stessa conferma inline usata per le voci.

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
  // --- Solo in modifica di un alimento esistente ---
  alimentoDaModificare?: Alimento;
  onModificato?: () => void;
  onEliminato?: () => void;
}

export default function CreaAlimentoForm({
  userId,
  nomeIniziale,
  onAnnulla,
  onCreato,
  alimentoDaModificare,
  onModificato,
  onEliminato,
}: Props) {
  const modifica = !!alimentoDaModificare;
  const a = alimentoDaModificare;

  const [nome, setNome] = useState(a ? a.nome : nomeIniziale);
  const [kcal, setKcal] = useState(a ? String(a.kcal_100g) : "");
  const [proteine, setProteine] = useState(a ? String(a.proteine_100g) : "");
  const [carboidrati, setCarboidrati] = useState(a ? String(a.carboidrati_100g) : "");
  const [grassi, setGrassi] = useState(a ? String(a.grassi_100g) : "");
  const [porzione, setPorzione] = useState(a ? String(a.porzione_default_g) : "100");
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [confermaElim, setConfermaElim] = useState(false);

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

    const campi = {
      nome: nome.trim(),
      kcal_100g: kcalN,
      proteine_100g: proteineN,
      carboidrati_100g: carboidratiN,
      grassi_100g: grassiN,
      porzione_default_g: porzioneN,
    };

    setInCorso(true);
    try {
      if (alimentoDaModificare) {
        // Stessa riga (stesso id): aggiorna(), non crea(). `verificato`,
        // `fonte`, `marca`, `barcode` restano quelli che erano.
        await repositoryAlimenti.aggiorna(alimentoDaModificare.id, campi);
        onModificato?.();
      } else {
        const alimento = await repositoryAlimenti.crea({
          user_id: userId,
          marca: null,
          barcode: null,
          ...campi,
          zuccheri_100g: null,
          fibre_100g: null,
          saturi_100g: null,
          sale_100g: null,
          fonte: "manuale",
          verificato: false,
        });
        onCreato(alimento);
      }
    } catch {
      setInCorso(false);
      setErrore(
        alimentoDaModificare
          ? "Non è stato possibile salvare le modifiche. Riprova."
          : "Non è stato possibile salvare l'alimento. Riprova."
      );
    }
  }

  async function handleElimina() {
    if (!alimentoDaModificare) return;
    setErrore(null);
    setInCorso(true);
    try {
      // Cancellazione logica (deleted_at), come per tutte le tabelle.
      await repositoryAlimenti.elimina(alimentoDaModificare.id);
      onEliminato?.();
    } catch {
      setInCorso(false);
      setErrore("Non è stato possibile eliminare l'alimento. Riprova.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">
          {modifica ? "Modifica alimento" : "Nuovo alimento"}
        </h2>
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

      {modifica ? (
        /* Riga pulsanti in modifica: [Elimina] [Salva]; il tap su Elimina
           la trasforma in [No] [Sì, elimina] (conferma inline, stessa
           posizione). Per annullare la modifica si usa "Torna alla ricerca"
           qui sopra. */
        <div className="flex gap-3">
          {confermaElim ? (
            <>
              <button
                type="button"
                onClick={() => setConfermaElim(false)}
                disabled={inCorso}
                className={`flex-1 rounded-lg border border-border p-2 disabled:opacity-50 ${CLASSE_FOCUS}`}
              >
                No
              </button>
              <button
                type="button"
                onClick={handleElimina}
                disabled={inCorso}
                className={`flex-1 rounded-lg bg-warning p-2 font-medium text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
              >
                {inCorso ? "Elimino..." : "Sì, elimina"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfermaElim(true)}
                disabled={inCorso}
                className={`flex-1 rounded-lg border border-warning p-2 text-warning disabled:opacity-50 ${CLASSE_FOCUS}`}
              >
                Elimina
              </button>
              <button
                type="submit"
                disabled={inCorso}
                className={`flex-1 rounded-lg bg-accent p-2 font-medium text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
              >
                {inCorso ? "Salvataggio..." : "Salva"}
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          type="submit"
          disabled={inCorso}
          className={`w-full rounded-lg bg-accent p-2 font-medium text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {inCorso ? "Salvataggio..." : "Crea e scegli la quantità"}
        </button>
      )}
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
