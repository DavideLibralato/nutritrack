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
//
// Dal codice a barre (`daCodice`, solo in creazione; PUNTO_DI_PARTENZA.md
// §3, "Codice a barre", "Il modulo precompilato"): il campo "Codice a
// barre" in sola lettura, e — se il prodotto è stato trovato su Open Food
// Facts — i campi già compilati, l'avviso in cima, la riga della licenza
// in fondo e, se le kcal vengono dai kJ, una riga sotto le kcal. Niente si
// salva senza il tocco su Salva: i valori dei volontari si controllano.

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { catalogoLocale, salvaAlimento, type OrigineCodice } from "@/lib/repository/alimenti";
import { eliminaAlimenti, type TracciaRimozione } from "@/lib/repository/composizioni";
import { stessoCodice, testoDoppione, trovaDoppione } from "@/lib/catalogo/doppioniAlimenti";
import type { Alimento } from "@/lib/db/tipi";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { validaValoriAlimento, type CampoAlimento } from "@/lib/inserimento/valoriAlimento";
import { grammiPerCampo } from "@/lib/inserimento/grammi";
import { numeroPerCampo } from "@/lib/numeriDecimali";
import { haValori, type ProdottoOpenFoodFacts } from "@/lib/barcode/valoriOpenFoodFacts";
import IconaInfo from "./IconaInfo";

// Un alimento che nasce da un codice a barre: il codice (già nella forma
// di leggiCodice) e il prodotto trovato su Open Food Facts, oppure null se
// non c'era (modulo vuoto con il solo codice).
export interface DatiCodice {
  barcode: string;
  prodotto: ProdottoOpenFoodFacts | null;
}

// Un valore di Open Food Facts come testo di partenza del campo ("7,1");
// vuoto se OFF non ce l'ha.
function campoDa(valore: number | null | undefined): string {
  return valore === null || valore === undefined ? "" : numeroPerCampo(valore, 2);
}

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
  // --- Solo in creazione da un codice a barre ---
  // Ignorato in modifica: lì codice e fonte restano quelli della riga.
  daCodice?: DatiCodice;
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
  daCodice: daCodiceProp,
}: Props) {
  const modifica = !!alimentoDaModificare;
  const a = alimentoDaModificare;
  // Il codice conta solo in creazione (vedi Props).
  const daCodice = modifica ? undefined : daCodiceProp;
  const off = daCodice?.prodotto ?? null;
  const kcalOff = campoDa(off?.kcal_100g);

  const [nome, setNome] = useState(a ? a.nome : off?.nome || nomeIniziale);
  // Marca facoltativa: due prodotti omonimi di marche diverse hanno valori
  // diversi (PUNTO_DI_PARTENZA.md §4, `alimenti`). La colonna
  // `alimenti.marca` esiste già.
  const [marca, setMarca] = useState(a ? (a.marca ?? "") : (off?.marca ?? ""));
  // In modifica i campi partono dai valori salvati, con la virgola ("0,9"):
  // colonne numeric(7,2), quindi fino a due decimali. Da Open Food Facts
  // allo stesso modo, vuoti quelli che OFF non ha.
  const [kcal, setKcal] = useState(a ? numeroPerCampo(a.kcal_100g, 2) : kcalOff);
  const [proteine, setProteine] = useState(
    a ? numeroPerCampo(a.proteine_100g, 2) : campoDa(off?.proteine_100g)
  );
  const [carboidrati, setCarboidrati] = useState(
    a ? numeroPerCampo(a.carboidrati_100g, 2) : campoDa(off?.carboidrati_100g)
  );
  const [grassi, setGrassi] = useState(a ? numeroPerCampo(a.grassi_100g, 2) : campoDa(off?.grassi_100g));
  const [porzione, setPorzione] = useState(a ? grammiPerCampo(a.porzione_default_g) : "100");
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
  const barcode = daCodice?.barcode ?? null;
  const doppione = catalogo
    ? trovaDoppione(catalogo, { nome, marca, barcode }, { userId, escludiId: a?.id })
    : null;
  // Doppione per il codice: in arancio il campo del codice, non nome e
  // marca, che possono essere diversi (e cambiarli non servirebbe).
  const doppionePerCodice = doppione !== null && stessoCodice(doppione, { barcode });
  const doppionePerNome = doppione !== null && !doppionePerCodice;

  // "Calcolate dai kJ": vale finché le kcal sono ancora quelle calcolate.
  // Se l'utente le corregge con l'etichetta, la riga non è più vera.
  const kcalDaKj = off?.kcalDaKj === true && kcal === kcalOff;

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

    // Da un codice a barre: 'off' se almeno un valore è arrivato da Open
    // Food Facts, anche se poi corretto; 'barcode' se li ha scritti
    // l'utente (prodotto non trovato, o trovato senza valori).
    const origine: OrigineCodice | undefined = daCodice
      ? { barcode: daCodice.barcode, fonte: off && haValori(off) ? "off" : "barcode" }
      : undefined;

    setInCorso(true);
    try {
      const esito = await salvaAlimento(userId, campi, alimentoDaModificare?.id, origine);
      if (esito.esito !== "salvato") {
        // "doppione": nato fra l'ultimo ridisegno e il tocco (un altro
        // dispositivo, o il secondo di un doppio tocco): niente scritto.
        // Il messaggio «Hai già …» lo mostra la lettura live, che l'ha già
        // visto. "ha-gia-codice" arriva solo con un codice da aggiungere,
        // che questo form non passa ancora.
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

      {/* L'avviso del mockup "Valori da Open Food Facts": i valori li
          inseriscono dei volontari, si controllano con l'etichetta. Se OFF
          ha solo nome e marca, lo dice: i valori vanno scritti. */}
      {off && (
        <div role="status" className="flex gap-2 rounded-xl bg-accent/10 p-3 text-sm">
          <IconaInfo className="mt-0.5 shrink-0 text-accent" />
          {haValori(off) ? (
            <span>
              Valori trovati su Open Food Facts. <b>Controllali con l&apos;etichetta</b> prima di
              salvare: li inseriscono dei volontari.
            </span>
          ) : (
            <span>
              Prodotto trovato su Open Food Facts, ma senza valori: <b>scrivili dall&apos;etichetta</b>.
            </span>
          )}
        </div>
      )}

      <div>
        <label htmlFor="crea-nome" className="block text-sm font-medium mb-1">
          Nome
        </label>
        <input
          id="crea-nome"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-invalid={doppionePerNome}
          aria-describedby={doppionePerNome ? "crea-doppione" : undefined}
          className={`w-full rounded-lg border p-2 ${doppionePerNome ? "border-warning" : "border-border"} ${CLASSE_FOCUS}`}
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
          aria-invalid={doppionePerNome}
          aria-describedby={doppionePerNome ? "crea-doppione" : undefined}
          className={`w-full rounded-lg border p-2 ${doppionePerNome ? "border-warning" : "border-border"} ${CLASSE_FOCUS}`}
        />
        {/* Il doppione è la coppia nome + marca: il messaggio sta dopo
            tutti e due i campi, e tutti e due hanno il bordo arancio.
            Sotto il solo nome sembrava un errore sul nome (16/10). */}
        {doppione && doppionePerNome && (
          <MessaggioDoppione
            doppione={doppione}
            barcode={barcode}
            puoAprire={puoAprire}
            onApri={onApriEsistente}
          />
        )}
        <p className="text-xs text-muted mt-1">
          Per distinguere due prodotti con lo stesso nome ma marca diversa.
        </p>
      </div>

      {/* Il codice a barre, in sola lettura (decisione del 07/11): se è
          sbagliato si torna indietro e si scansiona di nuovo. readOnly e
          non disabled: si legge e si seleziona, e il lettore di schermo
          lo annuncia come campo. */}
      {daCodice && (
        <div>
          <label htmlFor="crea-codice" className="block text-sm font-medium mb-1">
            Codice a barre
          </label>
          <input
            id="crea-codice"
            type="text"
            readOnly
            value={daCodice.barcode}
            aria-invalid={doppionePerCodice}
            aria-describedby={doppionePerCodice ? "crea-doppione" : undefined}
            className={`w-full rounded-lg border bg-surface p-2 text-muted tabular-nums ${doppionePerCodice ? "border-warning" : "border-border"} ${CLASSE_FOCUS}`}
          />
          {doppione && doppionePerCodice && (
            <MessaggioDoppione
              doppione={doppione}
              barcode={barcode}
              puoAprire={puoAprire}
              onApri={onApriEsistente}
            />
          )}
        </div>
      )}

      {/* Ordine come sulle etichette dei prodotti: Kcal, Grassi, Carboidrati,
          Proteine (PUNTO_DI_PARTENZA.md §7, "Le barre macro"). */}
      <p className="text-xs uppercase tracking-wide text-muted">Valori per 100 g</p>
      <div className="space-y-3">
        <CampoNumero
          id="crea-kcal"
          etichetta="Calorie (kcal)"
          valore={kcal}
          errore={validazione.errori.kcal}
          nota={kcalDaKj ? "Calcolate dai kJ di Open Food Facts: controlla l'etichetta" : undefined}
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

      {/* La licenza dei dati (ODbL): chi li usa deve dire da dove vengono.
          Ogni volta che il prodotto è trovato, anche senza valori: nome e
          marca vengono comunque da OFF (Davide, 07/11). Solo un prodotto
          non trovato non la mostra. */}
      {off && <p className="text-xs text-muted">Dati da Open Food Facts · licenza ODbL</p>}

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

// «Hai già …» con "Apri" accanto: sotto Nome e Marca se il doppione è per
// nome e marca, sotto il codice se è per il codice (testoDoppione sceglie
// le parole). Sempre un solo messaggio, con lo stesso id a cui puntano i
// campi segnati.
function MessaggioDoppione(props: {
  doppione: Alimento;
  barcode: string | null;
  puoAprire: (alimento: Alimento) => boolean;
  onApri: (alimento: Alimento) => void;
}) {
  const { doppione } = props;
  return (
    <div className="mt-1 flex items-baseline justify-between gap-3">
      <p id="crea-doppione" className="text-sm text-warning">
        {testoDoppione(doppione, { barcode: props.barcode })}
      </p>
      {props.puoAprire(doppione) && (
        <button
          type="button"
          onClick={() => props.onApri(doppione)}
          className={`shrink-0 rounded text-sm font-medium text-accent underline ${CLASSE_FOCUS}`}
        >
          Apri
        </button>
      )}
    </div>
  );
}

function CampoNumero(props: {
  id: string;
  etichetta: string;
  valore: string;
  // Messaggio sotto il campo, allineato a destra sotto l'input.
  errore?: string;
  // Una riga grigia sotto il campo, che non è un errore (le kcal calcolate
  // dai kJ). Con un errore, si mostra l'errore.
  nota?: string;
  onChange: (valore: string) => void;
}) {
  const idErrore = `${props.id}-errore`;
  const idNota = `${props.id}-nota`;
  const descrizione = props.errore ? idErrore : props.nota ? idNota : undefined;
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
          aria-describedby={descrizione}
          className={`w-28 rounded-lg border p-2 text-right ${props.errore ? "border-warning" : "border-border"} ${CLASSE_FOCUS}`}
        />
      </div>
      {props.errore ? (
        <p id={idErrore} className="mt-1 text-right text-sm text-warning">
          {props.errore}
        </p>
      ) : (
        props.nota && (
          <p id={idNota} className="mt-1 text-right text-xs text-muted">
            {props.nota}
          </p>
        )
      )}
    </div>
  );
}
