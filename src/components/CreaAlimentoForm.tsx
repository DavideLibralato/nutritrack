"use client";

// Creazione a mano di un alimento, quando la ricerca nel catalogo locale non
// lo trova (PUNTO_DI_PARTENZA.md, sezione 3: "un modo per crearlo a mano").
// I valori sono per 100 g (sezione 9.3), più la porzione predefinita in
// grammi che poi lo sheet quantità userà come default.
//
// Si apre da due posti: /aggiungi e Impostazioni > Alimenti (sezione 3,
// "Alimenti"). Quello che cambia fra i due sono solo i testi
// `etichettaIndietro` ed `etichettaCrea`, passati dal chiamante.
//
// Lo stesso form serve anche a **modificare** un alimento del catalogo, ma
// solo se creato dall'utente e non ancora verificato (sezione 10.8: un
// alimento verificato non si modifica, se ne crea uno nuovo; quelli
// condivisi non si toccano — vale anche a livello RLS). In quel caso il
// chiamante passa `alimentoDaModificare`: i campi partono dai valori reali,
// il salvataggio fa aggiorna() sulla stessa riga, e compare l'eliminazione
// (logica, deleted_at) con la stessa conferma inline usata per le voci.
//
// Mai due alimenti uguali (stesso nome e stessa marca, regola in
// src/lib/catalogo/doppioniAlimenti.ts): mentre si scrive il form guarda il
// catalogo e, se c'è già, scrive sotto la marca il messaggio di
// testoDoppione con "Apri" accanto, segna in arancio nome e marca, e
// spegne il Salva. Al Salva salvaAlimento rilegge il
// catalogo e scrive nella stessa transazione. Cosa fa "Apri" lo decide il
// chiamante (`onApriEsistente`, `puoAprire`).

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { catalogoLocale, salvaAlimento } from "@/lib/repository/alimenti";
import { eliminaAlimenti, type TracciaRimozione } from "@/lib/repository/composizioni";
import { testoDoppione, trovaDoppione } from "@/lib/catalogo/doppioniAlimenti";
import type { Alimento } from "@/lib/db/tipi";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { validaValoriAlimento, type CampoAlimento } from "@/lib/inserimento/valoriAlimento";

// Come si chiamano i campi nell'elenco "Per salvare mancano: ...".
const ETICHETTE_MANCANTI: Record<CampoAlimento, string> = {
  kcal: "calorie",
  grassi: "grassi",
  carboidrati: "carboidrati",
  proteine: "proteine",
  porzione: "porzione",
  zuccheri: "zuccheri",
  fibre: "fibre",
  saturi: "saturi",
  sale: "sale",
};

interface Props {
  userId: string;
  nomeIniziale: string;
  // I due testi che dipendono da dove si apre il form: in Aggiungi
  // "Torna alla ricerca" e "Crea e scegli la quantità" (dopo la creazione
  // si sceglie subito la quantità), in Impostazioni > Alimenti "Torna al
  // catalogo" e "Salva". Obbligatori, senza un valore predefinito: chi
  // apre il form dice sempre dove si torna.
  etichettaIndietro: string;
  etichettaCrea: string;
  onAnnulla: () => void;
  onCreato: (alimento: Alimento) => void;
  // "Apri" accanto a «Hai già …»: porta all'alimento che c'è già. In
  // Aggiungi, da "Nuovo alimento", apre il suo sheet quantità (l'utente
  // voleva registrarlo); altrove apre "Modifica alimento" di quello.
  // `puoAprire` dice se quell'alimento si può aprire (in Modifica solo se
  // modificabile): se no, il messaggio resta e "Apri" non compare.
  onApriEsistente: (alimento: Alimento) => void;
  puoAprire: (alimento: Alimento) => boolean;
  // --- Solo in modifica di un alimento esistente ---
  alimentoDaModificare?: Alimento;
  onModificato?: () => void;
  // Riceve cosa ha toccato la cancellazione, perché l'"Annulla" non può
  // vivere qui: il chiamante smonta questo form subito dopo (vedi
  // /aggiungi, BarraAnnulla).
  onEliminato?: (alimento: Alimento, traccia: TracciaRimozione) => void;
}

export default function CreaAlimentoForm({
  userId,
  nomeIniziale,
  etichettaIndietro,
  etichettaCrea,
  onAnnulla,
  onCreato,
  onApriEsistente,
  puoAprire,
  alimentoDaModificare,
  onModificato,
  onEliminato,
}: Props) {
  const modifica = !!alimentoDaModificare;
  const a = alimentoDaModificare;

  const [nome, setNome] = useState(a ? a.nome : nomeIniziale);
  // Marca facoltativa: due prodotti omonimi di marche diverse hanno valori
  // diversi (PUNTO_DI_PARTENZA.md §4, `alimenti`). La colonna
  // `alimenti.marca` esiste già.
  const [marca, setMarca] = useState(a?.marca ?? "");
  const [kcal, setKcal] = useState(a ? String(a.kcal_100g) : "");
  const [proteine, setProteine] = useState(a ? String(a.proteine_100g) : "");
  const [carboidrati, setCarboidrati] = useState(a ? String(a.carboidrati_100g) : "");
  const [grassi, setGrassi] = useState(a ? String(a.grassi_100g) : "");
  const [porzione, setPorzione] = useState(a ? String(a.porzione_default_g) : "100");
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [confermaElim, setConfermaElim] = useState(false);

  // Validazione a ogni ridisegno (src/lib/inserimento/valoriAlimento.ts):
  // limiti di numeric(7,2), arrotondamento a due decimali, limiti fisici per
  // 100 g. Il messaggio compare accanto al campo mentre si scrive, e il
  // pulsante resta spento finché c'è un errore o manca qualcosa.
  const validazione = validaValoriAlimento({ kcal, grassi, carboidrati, proteine, porzione });
  const mancanti = [
    ...(nome.trim() === "" ? ["nome"] : []),
    ...validazione.mancanti.map((c) => ETICHETTE_MANCANTI[c]),
  ];
  // Il catalogo dell'utente, letto con useLiveQuery: un hook di Dexie che
  // rilegge e ridisegna da solo quando IndexedDB cambia, anche per un
  // alimento arrivato con la sync da un altro telefono. undefined finché
  // la prima lettura non è pronta: lì il controllo lo fa solo il Salva.
  const catalogo = useLiveQuery(() => catalogoLocale(userId), [userId]);
  const doppione = catalogo
    ? trovaDoppione(catalogo, { nome, marca }, { userId, escludiId: a?.id })
    : null;

  const salvabile = validazione.valori !== null && nome.trim() !== "" && doppione === null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    // Il pulsante è già spento in questi casi; Invio da tastiera no.
    const valori = validazione.valori;
    if (!valori || !salvabile) return;

    // Ordine dei macro come sulle etichette reali dei prodotti: Kcal, Grassi,
    // Carboidrati, Proteine (PUNTO_DI_PARTENZA.md §7, "Le barre macro").
    // Valori già arrotondati a due decimali, come li terrà il server. Gli
    // spazi di nome e marca li sistema salvaAlimento.
    const campi = {
      nome,
      marca,
      kcal_100g: valori.kcal_100g,
      grassi_100g: valori.grassi_100g,
      carboidrati_100g: valori.carboidrati_100g,
      proteine_100g: valori.proteine_100g,
      porzione_default_g: valori.porzione_default_g,
    };

    setInCorso(true);
    try {
      const esito = await salvaAlimento(userId, campi, alimentoDaModificare?.id);
      if (esito.esito === "doppione") {
        // Nato fra l'ultimo ridisegno e il tocco (un altro dispositivo, o
        // il secondo di un doppio tocco): niente scritto. Il messaggio
        // «Hai già …» lo mostra la lettura live, che l'ha già visto.
        setInCorso(false);
        return;
      }
      if (alimentoDaModificare) onModificato?.();
      else onCreato(esito.alimento);
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
      // Cascata sui pasti salvati e cancellazione logica (deleted_at)
      // dell'alimento, tutto o niente in una transazione: la stessa funzione
      // dell'eliminazione multipla in Impostazioni > Alimenti
      // (src/lib/repository/composizioni.ts). Fino al 15/10 erano due
      // scritture separate, in un ordine scelto perché un guasto a metà
      // lasciasse uno stato visibile: la transazione non era possibile
      // finché la sync partiva dentro di lei (risolto il 9/10 in
      // repository.ts). Un guasto ora non lascia niente: l'alimento resta
      // nel catalogo con tutti i suoi pasti salvati, e si può riprovare.
      //
      // La traccia (cosa è stato cancellato davvero) passa al chiamante per
      // l'Annulla: ripristinaAlimentoEliminato.
      const traccia = await eliminaAlimenti(userId, [alimentoDaModificare.id]);
      onEliminato?.(alimentoDaModificare, traccia);
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
          {etichettaIndietro}
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
          aria-invalid={doppione !== null}
          aria-describedby={doppione ? "crea-doppione" : undefined}
          className={`w-full rounded-lg border p-2 ${doppione ? "border-warning" : "border-border"} ${CLASSE_FOCUS}`}
        />
      </div>

      <div>
        <label htmlFor="crea-marca" className="block text-sm font-medium mb-1">
          Marca <span className="font-normal text-muted">(facoltativa)</span>
        </label>
        <input
          id="crea-marca"
          type="text"
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          aria-invalid={doppione !== null}
          aria-describedby={doppione ? "crea-doppione" : undefined}
          className={`w-full rounded-lg border p-2 ${doppione ? "border-warning" : "border-border"} ${CLASSE_FOCUS}`}
        />
        {/* Il doppione è la coppia nome + marca: il messaggio sta dopo
            tutti e due i campi, e tutti e due hanno il bordo arancio.
            Sotto il solo nome sembrava un errore sul nome (16/10). */}
        {doppione && (
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p id="crea-doppione" className="text-sm text-warning">
              {testoDoppione(doppione)}
            </p>
            {puoAprire(doppione) && (
              <button
                type="button"
                onClick={() => onApriEsistente(doppione)}
                className={`shrink-0 rounded text-sm font-medium text-accent underline ${CLASSE_FOCUS}`}
              >
                Apri
              </button>
            )}
          </div>
        )}
        <p className="text-xs text-muted mt-1">
          Per distinguere due prodotti con lo stesso nome ma marca diversa.
        </p>
      </div>

      {/* Ordine come sulle etichette dei prodotti: Kcal, Grassi, Carboidrati,
          Proteine (PUNTO_DI_PARTENZA.md §7, "Le barre macro"). */}
      <p className="text-xs uppercase tracking-wide text-muted">Valori per 100 g</p>
      <div className="space-y-3">
        <CampoNumero
          id="crea-kcal"
          etichetta="Calorie (kcal)"
          valore={kcal}
          errore={validazione.errori.kcal}
          onChange={setKcal}
        />
        <CampoNumero
          id="crea-grassi"
          etichetta="Grassi (g)"
          valore={grassi}
          errore={validazione.errori.grassi}
          onChange={setGrassi}
        />
        <CampoNumero
          id="crea-carboidrati"
          etichetta="Carboidrati (g)"
          valore={carboidrati}
          errore={validazione.errori.carboidrati}
          onChange={setCarboidrati}
        />
        <CampoNumero
          id="crea-proteine"
          etichetta="Proteine (g)"
          valore={proteine}
          errore={validazione.errori.proteine}
          onChange={setProteine}
        />
        {/* La somma dei macro non è colpa di un campo solo: il messaggio sta
            sotto tutto il gruppo. */}
        {validazione.erroreSomma && (
          <p role="status" className="text-sm text-warning">
            {validazione.erroreSomma}
          </p>
        )}
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
          aria-invalid={!!validazione.errori.porzione}
          aria-describedby={validazione.errori.porzione ? "crea-porzione-errore" : undefined}
          className={`w-full rounded-lg border p-2 ${validazione.errori.porzione ? "border-warning" : "border-border"} ${CLASSE_FOCUS}`}
        />
        {validazione.errori.porzione && (
          <p id="crea-porzione-errore" className="mt-1 text-sm text-warning">
            {validazione.errori.porzione}
          </p>
        )}
        <p className="text-xs text-muted mt-1">
          È il valore già pronto nello sheet quantità: scegli quello che pesi più spesso.
        </p>
      </div>

      {/* Solo in modifica, sotto tutti i valori: cosa cambia salvando. Il
          diario copia i valori al momento dell'inserimento, i pasti salvati
          li leggono dal catalogo (PUNTO_DI_PARTENZA.md §3, "Alimenti"). */}
      {modifica && (
        <p className="text-sm text-muted">
          Le modifiche valgono da ora e nei pasti salvati. Il diario già registrato non cambia.
        </p>
      )}

      {errore && <p className="text-sm text-warning">{errore}</p>}

      {/* Perché il pulsante è spento, quando manca qualcosa: i campi vuoti
          non si segnano in rosso uno per uno (un form nuovo parte vuoto, non
          sbagliato), si elencano qui. */}
      {mancanti.length > 0 && (
        <p className="text-sm text-muted">Per salvare mancano: {mancanti.join(", ")}.</p>
      )}

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
                className={`flex-1 rounded-lg bg-warning-strong p-2 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
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
                disabled={inCorso || !salvabile}
                className={`flex-1 rounded-lg bg-accent-strong p-2 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
              >
                {inCorso ? "Salvataggio..." : "Salva"}
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          type="submit"
          disabled={inCorso || !salvabile}
          className={`w-full rounded-lg bg-accent-strong p-2 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {inCorso ? "Salvataggio..." : etichettaCrea}
        </button>
      )}
    </form>
  );
}

function CampoNumero(props: {
  id: string;
  etichetta: string;
  valore: string;
  // Messaggio sotto il campo, allineato a destra sotto l'input.
  errore?: string;
  onChange: (valore: string) => void;
}) {
  const idErrore = `${props.id}-errore`;
  return (
    <div>
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
          aria-invalid={!!props.errore}
          aria-describedby={props.errore ? idErrore : undefined}
          className={`w-28 rounded-lg border p-2 text-right ${props.errore ? "border-warning" : "border-border"} ${CLASSE_FOCUS}`}
        />
      </div>
      {props.errore && (
        <p id={idErrore} className="mt-1 text-right text-sm text-warning">
          {props.errore}
        </p>
      )}
    </div>
  );
}
