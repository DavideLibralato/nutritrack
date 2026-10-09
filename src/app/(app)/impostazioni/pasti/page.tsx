"use client";

// Impostazioni > Pasti e orari (PUNTO_DI_PARTENZA.md, sezione 3, "Pasti e
// orari"; mockup in docs/mockups/pasti-e-orari.html, elenco "A · Righe").
// Passo 3: rinominare, cambiare l'ora, aggiungere. Elimina è il passo 4, le
// date future il passo 5.
//
// L'elenco mostra i pasti che valgono OGGI, in ordine d'orario. Un tocco
// apre lo sheet del pasto (SheetPasto). Al Salva:
// - cambia solo l'ora → si scrive subito, in ogni giorno del pasto;
// - cambia il nome → la domanda "da quando" (SheetDaQuando): Correggi o Da
//   oggi. Nome e ora si scrivono insieme, dopo la risposta. Niente domanda
//   se cambiano solo maiuscole o spazi, o se il pasto è nato oggi: si
//   corregge e basta (domandaPerNome);
// - "+ Aggiungi pasto": nome e ora, poi "Anche nei giorni passati" o "Da
//   oggi".
// Ogni azione si salva alla conferma, quindi la pagina non ha mai modifiche
// in sospeso: niente guardiano delle modifiche. Dopo ogni scrittura, la
// barra in basso con "Annulla" (come nel diario).
//
// I controlli stanno in controlliPasti.ts e le scritture in
// modifichePasti.ts, che li rifà al momento di scrivere: se nel frattempo
// una sync ha cambiato i pasti, l'errore torna sotto il campo giusto
// (ErroreControlloPasto).
//
// Concetto React: lo sheet è uno STATO della pagina (useState), non una
// pagina a sé. `sheet` dice cosa è aperto e a che punto: i campi, o la
// domanda. "Indietro" dalla domanda rimette i campi come li avevi lasciati,
// perché la pagina tiene la bozza (nome e ora scritti) nello stato.

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId } from "@/lib/supabase/useUtente";
import { tuttiIPasti } from "@/lib/repository/pasti";
import { pastiValidiIl } from "@/lib/pasti/validitaPasti";
import {
  domandaPerNome,
  erroreNome,
  erroreOra,
  normalizzaNome,
  normalizzaOra,
  periodoDi,
  regoleElimina,
  type Periodo,
} from "@/lib/pasti/controlliPasti";
import {
  aggiungiPasto,
  annullaModificaPasti,
  correggiPasto,
  eliminaPasto,
  ErroreControlloPasto,
  rinominaDaOggi,
  vociDaEliminare,
  riepilogoVoci,
  type ModoElimina,
  type FotografiaPasti,
} from "@/lib/repository/modifichePasti";
import { oggiLocale } from "@/lib/dataGiorno";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { MESSAGGIO_ANNULLATO, type MessaggioBarra } from "@/lib/inserimento/testiBarra";
import type { Pasto, VoceDiario } from "@/lib/db/tipi";
import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import RigaImpostazioni from "@/components/RigaImpostazioni";
import BarraAnnulla from "@/components/BarraAnnulla";
import SheetPasto, { type ErroriPasto } from "@/components/SheetPasto";
import SheetDaQuando, { type OpzioneDaQuando } from "@/components/SheetDaQuando";
import SheetConferma from "@/components/SheetConferma";

const CLASSE_MAIN =
  "mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+var(--spazio-fra-barre))]";

const ERRORE_SALVATAGGIO = "Non è stato possibile salvare. Riprova.";
const NOME_GIA_USATO_NEL_PASSATO = "Nei giorni passati c'è già un pasto con questo nome.";

interface Bozza {
  nome: string;
  ora: string;
}

// Per "modifica", oltre ai campi e alla domanda del nome, i due passi di
// Elimina pasto: la domanda "da quando" e la conferma (solo se tocca voci).
type StatoSheet =
  | {
      tipo: "modifica";
      pastoId: string;
      bozza: Bozza;
      passo: "campi" | "domanda" | "elimina-domanda" | "elimina-conferma";
      modoElimina?: ModoElimina;
    }
  | { tipo: "aggiungi"; bozza: Bozza; passo: "campi" | "domanda" };

interface StatoBarra {
  // Cambia a ogni messaggio: la barra riparte da capo (la sua `key`).
  id: number;
  messaggio: MessaggioBarra;
  // Con la fotografia la barra ha "Annulla"; senza, è solo un messaggio.
  fotografia: FotografiaPasti | null;
}

type SceltaRinomina = "correggi" | "oggi";
type SceltaAggiunta = "passati" | "oggi";

// Il periodo della riga nuova di "Da oggi": da oggi alla fine del pasto.
function periodoDaOggi(pasto: Pasto, oggi: string): Periodo {
  return { dal: oggi, al: pasto.valido_al ?? null };
}

const DA_OGGI_IN_POI: (oggi: string) => Periodo = (oggi) => ({ dal: oggi, al: null });
const SEMPRE: Periodo = { dal: null, al: null };

export default function PastiEOrariPage() {
  const userId = useUtenteId();
  const righe = useLiveQuery(async () => {
    if (!userId) return undefined;
    return tuttiIPasti(userId);
  }, [userId]);

  const [sheet, setSheet] = useState<StatoSheet | null>(null);
  const [errori, setErrori] = useState<ErroriPasto>({});
  const [erroreDomanda, setErroreDomanda] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [barra, setBarra] = useState<StatoBarra | null>(null);

  // Le voci vive del pasto aperto, lette dal vivo: sono i numeri della
  // conferma di Elimina (e la frase "Le voci di oggi vengono eliminate.").
  // Se una sync ne porta una nuova mentre la conferma è aperta, i numeri
  // cambiano da soli.
  //
  // La lettura porta con sé l'id del pasto: appena si apre uno sheet,
  // useLiveQuery restituisce per un attimo il risultato della lettura di
  // prima (nessun pasto aperto, zero voci). Senza questo controllo, un
  // tocco veloce su Elimina vedeva "nessuna voce" e saltava la conferma
  // (trovato da un test instabile, 1 volta su 3). Finché la lettura non è
  // quella del pasto aperto, `vociPasto` è undefined e Elimina è spento.
  const pastoIdAperto = sheet?.tipo === "modifica" ? sheet.pastoId : null;
  const letturaVoci = useLiveQuery(
    async () =>
      pastoIdAperto ? { pastoId: pastoIdAperto, voci: await vociDaEliminare(pastoIdAperto, "tutto", oggiLocale()) } : null,
    [pastoIdAperto]
  );
  const vociPasto = letturaVoci && letturaVoci.pastoId === pastoIdAperto ? letturaVoci.voci : undefined;

  if (!userId || !righe) {
    return (
      <main className={CLASSE_MAIN}>
        <IntestazioneSottopagina titolo="Pasti e orari" />
        <p className="text-sm text-muted">Caricamento...</p>
      </main>
    );
  }

  const tutte = righe;
  const pastiOggi = pastiValidiIl(tutte, oggiLocale());
  const pastoAperto = sheet?.tipo === "modifica" ? tutte.find((p) => p.id === sheet.pastoId) : undefined;

  function mostraBarra(messaggio: MessaggioBarra, fotografia: FotografiaPasti | null) {
    setBarra((b) => ({ id: (b?.id ?? 0) + 1, messaggio, fotografia }));
  }

  function apriModifica(pasto: Pasto) {
    setErrori({});
    setErroreDomanda(null);
    setSheet({
      tipo: "modifica",
      pastoId: pasto.id,
      bozza: { nome: pasto.nome, ora: normalizzaOra(pasto.ora_inizio) },
      passo: "campi",
    });
  }

  function apriAggiunta() {
    setErrori({});
    setErroreDomanda(null);
    setSheet({ tipo: "aggiungi", bozza: { nome: "", ora: "" }, passo: "campi" });
  }

  function chiudi() {
    setSheet(null);
    setErrori({});
    setErroreDomanda(null);
  }

  // Esegue una scrittura: chiude lo sheet e mostra la barra con "Annulla",
  // o rimette l'errore dove serve. Un controllo non superato al momento
  // della scrittura (i pasti cambiati da una sync) torna sotto il suo campo.
  async function esegui(scrittura: () => Promise<{ fotografia: FotografiaPasti; messaggio: MessaggioBarra }>) {
    setInCorso(true);
    try {
      const { fotografia, messaggio } = await scrittura();
      chiudi();
      mostraBarra(messaggio, fotografia);
    } catch (errore) {
      if (errore instanceof ErroreControlloPasto) {
        setSheet((s) => (s ? { ...s, passo: "campi" } : s));
        setErroreDomanda(null);
        setErrori({ [errore.campo]: errore.message });
      } else if (sheet?.passo === "domanda") {
        setErroreDomanda(ERRORE_SALVATAGGIO);
      } else {
        setErrori({ generale: ERRORE_SALVATAGGIO });
      }
    } finally {
      setInCorso(false);
    }
  }

  function salvaCampi(nome: string, ora: string) {
    if (!sheet) return;
    const oggi = oggiLocale();
    const bozza = { nome, ora };

    if (sheet.tipo === "aggiungi") {
      // Qui il controllo più largo, "da oggi": se il pasto andrebbe bene
      // solo da oggi, la domanda lo dirà bloccando l'altra scelta.
      const periodo = DA_OGGI_IN_POI(oggi);
      const nuoviErrori = {
        nome: erroreNome(nome, periodo, tutte, []),
        ora: erroreOra(ora, periodo, tutte, [], oggi),
      };
      if (nuoviErrori.nome || nuoviErrori.ora) {
        setErrori(nuoviErrori);
        return;
      }
      setSheet({ ...sheet, bozza, passo: "domanda" });
      return;
    }

    const pasto = pastoAperto;
    if (!pasto) {
      chiudi();
      return;
    }
    const domanda = domandaPerNome(pasto, nome, oggi);
    const oraCambiata = normalizzaOra(ora) !== normalizzaOra(pasto.ora_inizio);
    const nuoviErrori = {
      nome:
        domanda === "niente"
          ? null
          : erroreNome(nome, domanda === "chiedi" ? periodoDaOggi(pasto, oggi) : periodoDi(pasto), tutte, [pasto.id]),
      ora: oraCambiata ? erroreOra(ora, periodoDi(pasto), tutte, [pasto.id], oggi) : null,
    };
    if (nuoviErrori.nome || nuoviErrori.ora) {
      setErrori(nuoviErrori);
      return;
    }
    if (domanda === "niente" && !oraCambiata) {
      chiudi();
      return;
    }
    if (domanda === "chiedi") {
      setSheet({ ...sheet, bozza, passo: "domanda" });
      return;
    }
    void esegui(async () => ({
      fotografia: await correggiPasto({ id: pasto.id, nome, ora, oggi }),
      messaggio:
        domanda === "niente"
          ? messaggioOra(pasto.nome, ora)
          : messaggioCorretto(normalizzaNome(nome), oraCambiata ? ora : null),
    }));
  }

  function confermaRinomina(scelta: SceltaRinomina) {
    if (!pastoAperto || sheet?.tipo !== "modifica") return;
    const pasto = pastoAperto;
    const { nome, ora } = sheet.bozza;
    const oggi = oggiLocale();
    const oraCambiata = normalizzaOra(ora) !== normalizzaOra(pasto.ora_inizio);
    setErroreDomanda(null);
    if (scelta === "correggi") {
      void esegui(async () => ({
        fotografia: await correggiPasto({ id: pasto.id, nome, ora, oggi }),
        messaggio: messaggioCorretto(normalizzaNome(nome), oraCambiata ? ora : null),
      }));
      return;
    }
    void esegui(async () => {
      const esito = await rinominaDaOggi({ id: pasto.id, nome, ora, oggi });
      return {
        fotografia: esito.fotografia,
        messaggio: { testo: "Rinominato da oggi:", nome: esito.pastoNuovo.nome, coda: `fino a ieri resta ${pasto.nome}.`, icona: "spunta" },
      };
    });
  }

  function confermaAggiunta(scelta: SceltaAggiunta) {
    if (sheet?.tipo !== "aggiungi" || !userId) return;
    const { nome, ora } = sheet.bozza;
    const daOggi = scelta === "oggi";
    setErroreDomanda(null);
    void esegui(async () => {
      const { fotografia, pasto } = await aggiungiPasto({ userId, nome, ora, daOggi, oggi: oggiLocale() });
      return {
        fotografia,
        messaggio: {
          testo: "Aggiunto:",
          nome: pasto.nome,
          coda: daOggi ? `da oggi, alle ${pasto.ora_inizio}.` : `alle ${pasto.ora_inizio}.`,
          icona: "spunta",
        },
      };
    });
  }

  async function annulla() {
    const fotografia = barra?.fotografia;
    if (!fotografia) return;
    try {
      const esito = await annullaModificaPasti(fotografia);
      mostraBarra(
        typeof esito === "object"
          ? { testo: esito.conflitto, icona: "info" }
          : esito === "pasto-con-voci"
            ? { testo: "Non annullato: il pasto ha già delle voci.", icona: "info" }
            : MESSAGGIO_ANNULLATO,
        null
      );
    } catch {
      mostraBarra({ testo: "Non è stato possibile annullare.", icona: "info" }, null);
    }
  }

  // --- Elimina pasto (passo 4) ---------------------------------------------
  // Pulsante nello sheet → (domanda "da quando", salvo pasto nato oggi) →
  // (conferma, solo se l'eliminazione tocca voci) → scrittura e barra.

  function avviaElimina() {
    if (!pastoAperto || sheet?.tipo !== "modifica" || vociPasto === undefined) return;
    setErroreDomanda(null);
    if (regoleElimina(pastoAperto, tutte, oggiLocale()).senzaDomanda) {
      sceltaElimina("tutto");
      return;
    }
    setSheet({ ...sheet, passo: "elimina-domanda" });
  }

  // Scelto il modo: se tocca voci, la conferma con i numeri; se no, subito.
  function sceltaElimina(modo: ModoElimina) {
    if (sheet?.tipo !== "modifica") return;
    setErroreDomanda(null);
    const voci = vociDelModo(modo);
    if (voci.length > 0) {
      setSheet({ ...sheet, passo: "elimina-conferma", modoElimina: modo });
      return;
    }
    void eseguiElimina(modo, []);
  }

  function vociDelModo(modo: ModoElimina) {
    const oggi = oggiLocale();
    return (vociPasto ?? []).filter((v) => modo === "tutto" || v.data === oggi);
  }

  // `idVoci`: le voci che l'utente ha appena visto nella conferma. Se nel
  // frattempo sono cambiate, niente è scritto: la conferma resta aperta,
  // con i numeri nuovi (letti dal vivo) e un avviso.
  async function eseguiElimina(modo: ModoElimina, idVoci: string[]) {
    if (!pastoAperto || sheet?.tipo !== "modifica") return;
    const pasto = pastoAperto;
    setInCorso(true);
    try {
      const esito = await eliminaPasto({ id: pasto.id, modo, oggi: oggiLocale(), idVociConfermate: idVoci });
      if (esito.esito === "cambiate") {
        setSheet({ ...sheet, passo: "elimina-conferma", modoElimina: modo });
        setErroreDomanda("Nel frattempo le voci sono cambiate: controlla i numeri e conferma di nuovo.");
        return;
      }
      chiudi();
      mostraBarra(messaggioEliminato(pasto.nome, modo, esito.riepilogo.voci), esito.fotografia);
    } catch {
      // Dallo sheet del pasto (pasto nato oggi, senza voci) l'errore va
      // sotto i campi; dalla domanda o dalla conferma, lì.
      if (sheet.passo === "campi") setErrori({ generale: ERRORE_SALVATAGGIO });
      else setErroreDomanda(ERRORE_SALVATAGGIO);
    } finally {
      setInCorso(false);
    }
  }

  return (
    <main className={CLASSE_MAIN}>
      <IntestazioneSottopagina titolo="Pasti e orari" />
      <p className="mx-1 -mt-2 text-sm leading-snug text-muted">
        Ogni pasto inizia alla sua ora e dura fino al successivo. Quando registri per oggi, l&apos;app
        propone il pasto in corso.
      </p>

      <GruppoImpostazioni>
        {pastiOggi.map((pasto) => (
          <RigaImpostazioni
            key={pasto.id}
            etichetta={pasto.nome}
            valore={normalizzaOra(pasto.ora_inizio)}
            onClick={() => apriModifica(pasto)}
          />
        ))}
        <button
          type="button"
          onClick={apriAggiunta}
          className={`riga-impostazioni relative flex min-h-[52px] w-full items-center justify-center px-4 text-base font-medium text-accent ${CLASSE_FOCUS}`}
        >
          + Aggiungi pasto
        </button>
      </GruppoImpostazioni>

      {barra && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[var(--ingombro-tab-bar)] z-40 mx-auto max-w-md">
          <BarraAnnulla
            key={barra.id}
            {...barra.messaggio}
            azione={barra.fotografia ? { etichetta: "Annulla", onClick: () => void annulla() } : undefined}
            onChiudi={() => setBarra(null)}
          />
        </div>
      )}

      {sheet?.passo === "campi" && (
        <SheetPasto
          titolo={sheet.tipo === "aggiungi" ? "Nuovo pasto" : (pastoAperto?.nome ?? "")}
          sottotitolo={
            sheet.tipo === "modifica" && pastoAperto
              ? `Inizia alle ${normalizzaOra(pastoAperto.ora_inizio)}. Il nuovo nome chiede da quando vale; il nuovo orario vale subito.`
              : undefined
          }
          nomeIniziale={sheet.bozza.nome}
          oraIniziale={sheet.bozza.ora}
          errori={errori}
          inCorso={inCorso}
          onCambiaCampo={(campo) => setErrori((e) => ({ ...e, [campo]: null, generale: null }))}
          onAnnulla={chiudi}
          onSalva={salvaCampi}
          elimina={
            sheet.tipo === "modifica" && pastoAperto
              ? {
                  motivoSpento: regoleElimina(pastoAperto, tutte, oggiLocale()).motivoSpento,
                  inAttesa: vociPasto === undefined,
                  onElimina: avviaElimina,
                }
              : undefined
          }
        />
      )}

      {sheet?.passo === "domanda" && sheet.tipo === "modifica" && pastoAperto && (
        <SheetDaQuando<SceltaRinomina>
          titolo={`«${pastoAperto.nome}» diventa «${normalizzaNome(sheet.bozza.nome)}»`}
          opzioni={opzioniRinomina(pastoAperto, sheet.bozza.nome, tutte)}
          predefinita="oggi"
          testoConferma="Rinomina"
          inCorso={inCorso}
          errore={erroreDomanda}
          onIndietro={() => setSheet({ ...sheet, passo: "campi" })}
          onConferma={confermaRinomina}
        />
      )}

      {sheet?.passo === "domanda" && sheet.tipo === "aggiungi" && (
        <SheetDaQuando<SceltaAggiunta>
          titolo={`Da quando c'è «${normalizzaNome(sheet.bozza.nome)}»?`}
          opzioni={opzioniAggiunta(sheet.bozza, tutte)}
          predefinita="oggi"
          testoConferma="Aggiungi pasto"
          inCorso={inCorso}
          errore={erroreDomanda}
          onIndietro={() => setSheet({ ...sheet, passo: "campi" })}
          onConferma={confermaAggiunta}
        />
      )}

      {sheet?.passo === "elimina-domanda" && sheet.tipo === "modifica" && pastoAperto && (
        <SheetDaQuando<ModoElimina>
          titolo={`Eliminare «${pastoAperto.nome}»?`}
          opzioni={[
            {
              chiave: "tutto",
              titolo: "Anche nei giorni passati",
              spiegazione: "Sparisce ovunque, insieme alle sue voci.",
              bloccata: regoleElimina(pastoAperto, tutte, oggiLocale()).motivoPassatiSpento,
            },
            {
              chiave: "oggi",
              titolo: "Da oggi",
              spiegazione:
                "I giorni passati restano come sono." +
                (vociDelModo("oggi").length > 0 ? " Le voci di oggi vengono eliminate." : ""),
            },
          ]}
          predefinita="oggi"
          testoConferma={(modo) => (vociDelModo(modo).length > 0 ? "Continua" : "Elimina pasto")}
          inCorso={inCorso}
          errore={erroreDomanda}
          onIndietro={() => setSheet({ ...sheet, passo: "campi" })}
          onConferma={sceltaElimina}
        />
      )}

      {sheet?.passo === "elimina-conferma" && sheet.tipo === "modifica" && pastoAperto && sheet.modoElimina && (
        <ConfermaElimina
          nome={pastoAperto.nome}
          modo={sheet.modoElimina}
          voci={vociDelModo(sheet.modoElimina)}
          inCorso={inCorso}
          errore={erroreDomanda}
          onNo={chiudi}
          onSi={(idVoci) => void eseguiElimina(sheet.modoElimina as ModoElimina, idVoci)}
        />
      )}
    </main>
  );
}

// "voce" / "voci", "giorno" / "giorni".
function voci(n: number): string {
  return `${n} voc${n === 1 ? "e" : "i"}`;
}

// La conferma prima di eliminare un pasto con delle voci (mockup, senza
// "Non si può annullare.": dopo c'è la barra con Annulla). I numeri sono
// quelli delle voci vive adesso; il Sì manda gli id di queste voci, così
// la scrittura sa se nel frattempo sono cambiate.
function ConfermaElimina({
  nome,
  modo,
  voci: righe,
  inCorso,
  errore,
  onNo,
  onSi,
}: {
  nome: string;
  modo: ModoElimina;
  voci: VoceDiario[];
  inCorso: boolean;
  errore: string | null;
  onNo: () => void;
  onSi: (idVoci: string[]) => void;
}) {
  const { voci: n, giorni, kcal } = riepilogoVoci(righe);
  const dove = modo === "tutto" ? `in ${giorni} ${giorni === 1 ? "giorno" : "giorni"}` : "oggi";
  const quali = modo === "tutto" ? "di quei giorni" : "di oggi";
  return (
    <SheetConferma
      titolo={`Eliminare anche ${voci(n)}?`}
      testo={`«${nome}» ha ${voci(n)} ${dove}, per ${Math.round(kcal).toLocaleString("it-IT")} kcal. Verranno eliminate e i totali ${quali} scenderanno.`}
      etichettaNo="Annulla"
      etichettaSi={`Elimina pasto e ${voci(n)}`}
      distruttiva
      inCorso={inCorso}
      errore={errore}
      onNo={onNo}
      onSi={() => onSi(righe.map((v) => v.id))}
    />
  );
}

// "Eliminato: Pranzo (13 voci)", "Eliminato da oggi: Cena (1 voce di
// oggi)", "Eliminato: Spuntino pomeriggio".
function messaggioEliminato(nome: string, modo: ModoElimina, numeroVoci: number): MessaggioBarra {
  if (modo === "oggi") {
    return {
      testo: "Eliminato da oggi:",
      nome,
      coda: numeroVoci > 0 ? `(${voci(numeroVoci)} di oggi)` : undefined,
      icona: "elimina",
    };
  }
  return { testo: "Eliminato:", nome, coda: numeroVoci > 0 ? `(${voci(numeroVoci)})` : undefined, icona: "elimina" };
}

// "Correggi" riscrive anche i giorni passati: se lì il nome nuovo c'è già,
// si blocca (resta "Da oggi").
function opzioniRinomina(pasto: Pasto, nome: string, righe: Pasto[]): OpzioneDaQuando<SceltaRinomina>[] {
  const bloccataCorreggi = erroreNome(nome, periodoDi(pasto), righe, [pasto.id]) ? NOME_GIA_USATO_NEL_PASSATO : null;
  return [
    { chiave: "correggi", titolo: "Correggi", spiegazione: "Vale anche per i giorni passati.", bloccata: bloccataCorreggi },
    { chiave: "oggi", titolo: "Da oggi", spiegazione: `Fino a ieri resta «${pasto.nome}».` },
  ];
}

// "Anche nei giorni passati" mette il pasto in ogni giorno: se lì nome o
// ora si scontrano con un pasto di allora, si blocca col motivo.
function opzioniAggiunta(bozza: Bozza, righe: Pasto[]): OpzioneDaQuando<SceltaAggiunta>[] {
  const oggi = oggiLocale();
  const bloccataPassati =
    (erroreNome(bozza.nome, SEMPRE, righe, []) ? NOME_GIA_USATO_NEL_PASSATO : null) ??
    erroreOra(bozza.ora, SEMPRE, righe, [], oggi);
  return [
    {
      chiave: "passati",
      titolo: "Anche nei giorni passati",
      spiegazione: "Compare vuoto anche nei giorni già registrati.",
      bloccata: bloccataPassati,
    },
    { chiave: "oggi", titolo: "Da oggi", spiegazione: "I giorni passati restano come sono." },
  ];
}

function messaggioOra(nome: string, ora: string): MessaggioBarra {
  return { testo: "Orario cambiato:", nome, coda: `ora inizia alle ${normalizzaOra(ora)}.`, icona: "spunta" };
}

function messaggioCorretto(nome: string, oraNuova: string | null): MessaggioBarra {
  return {
    testo: "Rinominato:",
    nome,
    coda: oraNuova
      ? `anche nei giorni passati, inizia alle ${normalizzaOra(oraNuova)}.`
      : "anche nei giorni passati.",
    icona: "spunta",
  };
}
