"use client";

// Modifica di un pasto salvato (PUNTO_DI_PARTENZA.md, sezione 3, "Salvare un
// pasto intero"): nome, alimenti con i grammi, "Elimina pasto". Si apre dalla
// matita sulla riga del pasto in Preferiti, dentro /aggiungi, e ne copre
// tutta l'altezza con una testata sua (quella di Aggiungi mostra il pasto
// della giornata, che qui non c'entra).
//
// Come il Profilo: tutto resta in sospeso finché non si preme Salva, e
// "Annulla modifiche" torna a com'era. Niente si scrive in Dexie prima del
// Salva. Unica eccezione, sempre dopo una conferma esplicita: eliminare il
// pasto ("Elimina pasto", o togliere l'ultimo alimento — un pasto salvato
// vuoto non deve esistere).
//
// La logica sta in src/lib/inserimento/modificaPastoSalvato.ts (senza
// React, con i test); qui solo lo schermo. I due moduli ("caricati" e
// "attuali") si leggono da Dexie UNA volta, all'apertura: la schermata non
// segue i dati in tempo reale, così l'elenco non cambia sotto il dito. Se
// nel frattempo il pasto cambia altrove, lo scopre il Salva.
//
// Il `catalogo` invece arriva vivo dalla pagina: serve alla ricerca e a
// segnalare una riga il cui alimento è sparito dal catalogo mentre la
// schermata era aperta (non verrà salvata, regola "Alimenti cancellati").

import { useEffect, useState } from "react";
import SheetQuantita from "@/components/SheetQuantita";
import SheetConferma from "@/components/SheetConferma";
import ValorePrecedente from "@/components/ValorePrecedente";
import { cercaPerNome, etichettaAlimento } from "@/lib/repository/alimenti";
import { eliminaComposizione } from "@/lib/repository/composizioni";
import { daAlimento } from "@/lib/inserimento/alimentoPerSheet";
import { elencoNomi } from "@/lib/inserimento/testiAlimentiCancellati";
import { numeroDaCampo } from "@/lib/profilo/salvataggioProfilo";
import {
  aggiungiAlimento,
  caricaModuloPasto,
  erroreGrammi,
  erroreNome,
  erroriRighe,
  grammiNelModulo,
  moduloModificato,
  salvaModificaPasto,
  type ModuloPasto,
  type RigaModulo,
} from "@/lib/inserimento/modificaPastoSalvato";
import type { Alimento } from "@/lib/db/tipi";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

interface Props {
  userId: string;
  composizioneId: string;
  catalogo: Alimento[];
  // Chiude la schermata; `messaggio` (se c'è) va mostrato dalla pagina nella
  // barra in basso, perché questa schermata a quel punto non c'è più.
  onChiudi: (messaggio: string | null) => void;
}

type Conferma = "ultimo-alimento" | "elimina-pasto" | "esci";

export default function ModificaPastoSalvato({ userId, composizioneId, catalogo, onChiudi }: Props) {
  const [caricati, setCaricati] = useState<ModuloPasto | null>(null);
  const [attuali, setAttuali] = useState<ModuloPasto | null>(null);
  const [cercando, setCercando] = useState(false);
  const [query, setQuery] = useState("");
  const [alimentoScelto, setAlimentoScelto] = useState<Alimento | null>(null);
  const [conferma, setConferma] = useState<Conferma | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [erroreConferma, setErroreConferma] = useState<string | null>(null);
  const [erroreNomeDoppio, setErroreNomeDoppio] = useState(false);
  const [messaggio, setMessaggio] = useState<string | null>(null);

  // Lettura iniziale, una volta sola. Se il pasto non c'è più (cancellato
  // un istante prima da un altro dispositivo) si torna indietro subito.
  useEffect(() => {
    let annullato = false;
    caricaModuloPasto(userId, composizioneId)
      .then((modulo) => {
        if (annullato) return;
        if (!modulo) {
          onChiudi("Questo pasto salvato non esiste più.");
          return;
        }
        setCaricati(modulo);
        setAttuali(modulo);
      })
      .catch(() => {
        if (!annullato) onChiudi("Non è stato possibile aprire il pasto salvato.");
      });
    return () => {
      annullato = true;
    };
    // onChiudi è una funzione nuova a ogni ridisegno della pagina: metterla
    // qui rileggerebbe il pasto (e butterebbe le modifiche) a ogni giro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, composizioneId]);

  const modificato = caricati && attuali ? moduloModificato(caricati, attuali) : false;

  // Chiusura o ricarica della scheda con modifiche non salvate: il browser
  // chiede conferma (stesso meccanismo del Profilo; il testo lo decide il
  // browser). Il gesto "indietro" del telefono non passa di qui: esce da
  // /aggiungi senza avviso, come il cambio di scheda in Profilo.
  useEffect(() => {
    if (!modificato) return;
    function avvisa(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", avvisa);
    return () => window.removeEventListener("beforeunload", avvisa);
  }, [modificato]);

  if (!caricati || !attuali) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-background">
        <p className="text-sm text-muted">Caricamento...</p>
      </div>
    );
  }

  const catalogoPerId = new Map(catalogo.map((a) => [a.id, a]));
  const errori = erroriRighe(attuali);
  const erroreSulNome = erroreNome(attuali.nome);
  const valido = !erroreSulNome && Object.keys(errori).length === 0;
  const caricatiPerChiave = new Map(caricati.righe.map((r) => [r.chiave, r]));
  const nomePasto = caricati.nome;

  // Kcal totali di ciò che è a schermo, dai valori vivi del catalogo (come
  // la riga in Preferiti). Le righe non valide o fuori catalogo non contano.
  const kcalTotali = Math.round(
    attuali.righe.reduce((somma, r) => {
      const a = catalogoPerId.get(r.alimentoId);
      if (!a || erroreGrammi(r.grammi)) return somma;
      return somma + (a.kcal_100g * numeroDaCampo(r.grammi)) / 100;
    }, 0)
  );

  function aggiorna(modulo: ModuloPasto) {
    setAttuali(modulo);
    setMessaggio(null);
    setErroreNomeDoppio(false);
  }

  function cambiaGrammi(chiave: string, grammi: string) {
    aggiorna({
      ...attuali!,
      righe: attuali!.righe.map((r) => (r.chiave === chiave ? { ...r, grammi } : r)),
    });
  }

  function togli(chiave: string) {
    // L'ultimo alimento: niente pasto vuoto in sospeso, si chiede subito se
    // eliminare il pasto (bug dei pasti fantasma del 2026-09-22).
    if (attuali!.righe.length === 1) {
      setErroreConferma(null);
      setConferma("ultimo-alimento");
      return;
    }
    aggiorna({ ...attuali!, righe: attuali!.righe.filter((r) => r.chiave !== chiave) });
  }

  function annullaModifiche() {
    aggiorna(caricati!);
  }

  function chiudiRicerca() {
    setCercando(false);
    setQuery("");
  }

  function esci() {
    if (modificato) {
      setErroreConferma(null);
      setConferma("esci");
    } else {
      onChiudi(null);
    }
  }

  function confermaQuantita(grammi: number) {
    if (!alimentoScelto) return;
    aggiorna(aggiungiAlimento(attuali!, alimentoScelto, grammi));
    setAlimentoScelto(null);
    chiudiRicerca();
  }

  // Elimina subito, dopo la conferma: fuori dal modello "in sospeso", perché
  // un'eliminazione che aspetta il Salva confonderebbe. eliminaComposizione
  // rilegge da Dexie le righe da cancellare.
  async function eliminaPasto() {
    setInCorso(true);
    setErroreConferma(null);
    try {
      await eliminaComposizione(userId, composizioneId);
      onChiudi(`Pasto salvato ${elencoNomi([nomePasto])} eliminato.`);
    } catch {
      setErroreConferma("Non è stato possibile eliminare il pasto. Riprova.");
      setInCorso(false);
    }
  }

  async function salva() {
    if (!modificato || !valido || inCorso) return;
    setInCorso(true);
    setMessaggio(null);
    try {
      const esito = await salvaModificaPasto({
        userId,
        composizioneId,
        caricati: caricati!,
        attuali: attuali!,
      });
      const nome = elencoNomi([attuali!.nome.trim()]);
      switch (esito.esito) {
        case "salvato": {
          let testo = `Pasto salvato ${nome} aggiornato.`;
          if (esito.esclusi.length > 0) {
            const uno = new Set(esito.esclusi).size === 1;
            testo += ` ${elencoNomi(esito.esclusi)} ${uno ? "non è più nel catalogo e non è stato salvato" : "non sono più nel catalogo e non sono stati salvati"}.`;
          }
          onChiudi(testo);
          return;
        }
        case "eliminato":
          onChiudi(
            `Pasto salvato ${elencoNomi([nomePasto])} eliminato: nessuno dei suoi alimenti è più nel catalogo.`
          );
          return;
        case "pasto-eliminato":
          onChiudi(
            `Il pasto salvato ${elencoNomi([nomePasto])} è stato eliminato da un altro dispositivo. Le modifiche non sono state salvate.`
          );
          return;
        case "pasto-cambiato":
          setCaricati(esito.caricati);
          setAttuali(esito.caricati);
          setMessaggio(
            "Questo pasto è stato modificato da un altro dispositivo: ora vedi la versione aggiornata. Le tue modifiche non sono state salvate, rifalle se servono."
          );
          break;
        case "nome-duplicato":
          setErroreNomeDoppio(true);
          setMessaggio("Esiste già un pasto salvato con questo nome.");
          break;
        case "da-correggere":
          setMessaggio("Correggi i campi segnati.");
          break;
      }
    } catch {
      setMessaggio("Non è stato possibile salvare. Riprova.");
    }
    setInCorso(false);
  }

  const risultati = query.trim() === "" ? [] : cercaPerNome(catalogo, query);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={cercando ? chiudiRicerca : esci}
          aria-label={cercando ? "Torna al pasto" : "Indietro"}
          className={`rounded p-1 text-muted ${CLASSE_FOCUS}`}
        >
          <ChevronSinistra />
        </button>
        <h1 className="min-w-0 truncate font-display text-2xl font-bold">
          {cercando ? "Aggiungi alimento" : "Modifica pasto salvato"}
        </h1>
      </header>

      {cercando ? (
        <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-5">
          <div className="relative shrink-0">
            <Lente className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca un alimento"
              aria-label="Cerca un alimento"
              autoFocus
              className={`h-11 w-full rounded-full border border-border bg-background pl-11 pr-4 text-base ${CLASSE_FOCUS}`}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {query.trim() === "" ? (
              <p className="px-1 pt-6 text-center text-sm leading-relaxed text-muted">
                Scrivi il nome di un alimento del catalogo. Se non c&apos;è, crealo prima da
                Aggiungi.
              </p>
            ) : risultati.length > 0 ? (
              <ul className="mt-2">
                {risultati.map((a) => {
                  const giaNelPasto = grammiNelModulo(attuali, a.id);
                  return (
                    <li key={a.id} className="border-b border-border">
                      <button
                        type="button"
                        onClick={() => setAlimentoScelto(a)}
                        className={`flex w-full flex-col py-3.5 text-left ${CLASSE_FOCUS}`}
                      >
                        <span className="truncate">{etichettaAlimento(a)}</span>
                        <span className="mt-0.5 text-sm text-muted">
                          {giaNelPasto !== null
                            ? `Già nel pasto · ${giaNelPasto} g`
                            : `${a.porzione_default_g} g · ${Math.round((a.kcal_100g * a.porzione_default_g) / 100)} kcal`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-1 pt-6 text-center text-sm leading-relaxed text-muted">
                Nessun risultato per «{query.trim()}». Se non è nel catalogo, crealo prima da
                Aggiungi.
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-5">
            <label htmlFor="pasto-nome" className="block text-sm font-medium">
              Nome
            </label>
            <input
              id="pasto-nome"
              type="text"
              value={attuali.nome}
              onChange={(e) => aggiorna({ ...attuali, nome: e.target.value })}
              aria-invalid={!!erroreSulNome || erroreNomeDoppio}
              className={`mt-1 w-full rounded-lg border border-border bg-background p-3 text-base ${CLASSE_FOCUS}`}
            />
            {erroreSulNome ? (
              <p className="mt-1 text-sm text-warning">{erroreSulNome}</p>
            ) : erroreNomeDoppio ? (
              <p className="mt-1 text-sm text-warning">
                Esiste già un pasto salvato con questo nome. Scegline un altro.
              </p>
            ) : (
              <ValorePrecedente
                visibile={attuali.nome.trim() !== caricati.nome.trim()}
                valore={caricati.nome}
              />
            )}

            <div className="mt-6 flex items-baseline justify-between">
              <p className="text-xs uppercase tracking-wide text-muted">Alimenti</p>
              <p className="text-sm text-muted">
                {attuali.righe.length} {attuali.righe.length === 1 ? "alimento" : "alimenti"} ·{" "}
                {kcalTotali} kcal
              </p>
            </div>
            <ul>
              {attuali.righe.map((r) => (
                <RigaAlimento
                  key={r.chiave}
                  riga={r}
                  prima={caricatiPerChiave.get(r.chiave) ?? null}
                  alimento={catalogoPerId.get(r.alimentoId) ?? null}
                  errore={errori[r.chiave] ?? null}
                  onCambiaGrammi={(g) => cambiaGrammi(r.chiave, g)}
                  onTogli={() => togli(r.chiave)}
                />
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setCercando(true)}
              className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-accent py-3 font-medium text-accent ${CLASSE_FOCUS}`}
            >
              <Piu size={18} />
              Aggiungi alimento
            </button>

            <button
              type="button"
              onClick={() => {
                setErroreConferma(null);
                setConferma("elimina-pasto");
              }}
              className={`mt-8 w-full rounded-lg border border-warning p-3 text-warning ${CLASSE_FOCUS}`}
            >
              Elimina pasto
            </button>
          </div>

          {/* Barra Salva/Annulla, come in Profilo (BarraSalvaProfilo). Con
              data-nascondi-mentre-scrivi (regola in globals.css) sparisce
              mentre un campo ha il fuoco: la pagina è agganciata al visual
              viewport, senza l'attributo resterebbe sopra la tastiera. */}
          <div
            data-nascondi-mentre-scrivi
            className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
          >
            <div role="status" className="text-sm">
              {messaggio ? (
                <p className="text-warning">{messaggio}</p>
              ) : !modificato ? (
                <p className="text-muted">Nessuna modifica da salvare.</p>
              ) : !valido ? (
                <p className="text-warning">Correggi i campi segnati per salvare.</p>
              ) : (
                <p>Il diario non cambia: la modifica vale da adesso.</p>
              )}
            </div>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={annullaModifiche}
                disabled={!modificato || inCorso}
                className={`flex-1 rounded-lg border border-border p-2 disabled:opacity-50 ${CLASSE_FOCUS}`}
              >
                Annulla modifiche
              </button>
              <button
                type="button"
                onClick={salva}
                disabled={!modificato || !valido || inCorso}
                className={`flex-1 rounded-lg bg-accent p-2 font-medium text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
              >
                {inCorso ? "Salvataggio..." : "Salva"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Lo sheet quantità di sempre (sezione 5): qui la conferma aggiunge la
          riga al modulo in memoria, non scrive nel diario. Niente stella:
          onTogglePreferito non si passa. Se l'alimento è già nel pasto, si
          apre coi suoi grammi e il valore confermato li sostituisce. */}
      {alimentoScelto && (
        <SheetQuantita
          alimento={daAlimento(catalogoPerId.get(alimentoScelto.id) ?? alimentoScelto)}
          nomePasto={attuali.nome.trim() || nomePasto}
          grammiIniziali={grammiNelModulo(attuali, alimentoScelto.id) ?? undefined}
          onAnnulla={() => setAlimentoScelto(null)}
          onConferma={confermaQuantita}
        />
      )}

      {conferma === "ultimo-alimento" && (
        <SheetConferma
          titolo="Togliere l'ultimo alimento?"
          testo={`È l'ultimo alimento del pasto: toglierlo elimina il pasto salvato ${elencoNomi([nomePasto])}. Il diario non cambia.`}
          etichettaNo="No"
          etichettaSi="Sì, elimina il pasto"
          distruttiva
          inCorso={inCorso}
          errore={erroreConferma}
          onNo={() => setConferma(null)}
          onSi={eliminaPasto}
        />
      )}
      {conferma === "elimina-pasto" && (
        <SheetConferma
          titolo={`Eliminare ${elencoNomi([nomePasto])}?`}
          testo="Il pasto salvato sparisce dai Preferiti. Il diario non cambia."
          etichettaNo="No"
          etichettaSi="Sì, elimina"
          distruttiva
          inCorso={inCorso}
          errore={erroreConferma}
          onNo={() => setConferma(null)}
          onSi={eliminaPasto}
        />
      )}
      {conferma === "esci" && (
        <SheetConferma
          titolo="Uscire senza salvare?"
          testo="Le modifiche a questo pasto salvato andranno perse."
          etichettaNo="Resta"
          etichettaSi="Esci"
          distruttiva
          onNo={() => setConferma(null)}
          onSi={() => onChiudi(null)}
        />
      )}
    </div>
  );
}

// Una riga dell'elenco: nome e kcal, campo dei grammi, "×" per toglierla.
// Sotto, in quest'ordine: l'avviso se l'alimento non è più nel catalogo,
// l'errore sui grammi, "Nuovo" per una riga aggiunta ora, "Prima: 20 g" se i
// grammi sono cambiati.
function RigaAlimento({
  riga,
  prima,
  alimento,
  errore,
  onCambiaGrammi,
  onTogli,
}: {
  riga: RigaModulo;
  prima: RigaModulo | null;
  alimento: Alimento | null;
  errore: string | null;
  onCambiaGrammi: (grammi: string) => void;
  onTogli: () => void;
}) {
  const nome = alimento ? etichettaAlimento(alimento) : riga.nomeAlimento;
  const idCampo = `grammi-${riga.chiave}`;
  const kcal =
    alimento && !errore ? Math.round((alimento.kcal_100g * numeroDaCampo(riga.grammi)) / 100) : null;
  const grammiCambiati =
    prima !== null && numeroDaCampo(prima.grammi) !== numeroDaCampo(riga.grammi);

  return (
    <li className="border-b border-border py-3">
      <div className="flex items-center gap-2">
        <label htmlFor={idCampo} className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{nome}</span>
          <span className="mt-0.5 text-sm text-muted">{kcal !== null ? `${kcal} kcal` : " "}</span>
        </label>
        <input
          id={idCampo}
          type="text"
          inputMode="decimal"
          value={riga.grammi}
          onChange={(e) => onCambiaGrammi(e.target.value)}
          aria-invalid={!!errore}
          aria-describedby={errore ? `${idCampo}-errore` : undefined}
          className={`w-20 shrink-0 rounded-lg border p-2 text-right text-base ${errore ? "border-warning" : "border-border"} bg-background ${CLASSE_FOCUS}`}
        />
        <span className="shrink-0 text-sm text-muted">g</span>
        <button
          type="button"
          onClick={onTogli}
          aria-label={`Togli ${nome} dal pasto`}
          className={`shrink-0 rounded p-1.5 text-muted ${CLASSE_FOCUS}`}
        >
          <Croce />
        </button>
      </div>
      {!alimento ? (
        <p className="mt-1 text-sm text-warning">Non è più nel catalogo: non verrà salvato.</p>
      ) : errore ? (
        <p id={`${idCampo}-errore`} className="mt-1 text-sm text-warning">
          {errore}
        </p>
      ) : prima === null ? (
        <p className="mt-1 text-sm text-accent">Nuovo</p>
      ) : (
        <ValorePrecedente visibile={grammiCambiati} valore={`${prima.grammi} g`} />
      )}
    </li>
  );
}

function ChevronSinistra() {
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

function Lente({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function Piu({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function Croce() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
