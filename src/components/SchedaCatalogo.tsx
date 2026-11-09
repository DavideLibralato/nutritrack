"use client";

// La scheda «Catalogo» di Impostazioni > Alimenti (PUNTO_DI_PARTENZA.md
// §10.1; mockup docs/mockups/catalogo-precaricato.html, schermata 1): il
// catalogo precaricato, dentro l'app, offline anche il primo giorno.
//
// - Ricerca su nome e marca, filtri per categoria (scorrono in
//   orizzontale), «Nascondi quelli che hai» (ricordato solo su questo
//   telefono, in localStorage), il conteggio, l'elenco, e in fondo da
//   dove vengono i valori.
// - «Aggiungi» crea un alimento tuo (aggiungiDalCatalogo): la riga passa
//   subito a «Nei tuoi» senza spostarsi, e la pagina mostra la barra con
//   «Apri» e «Annulla» (onAggiunto).
// - Un tocco sulla riga apre la scheda dell'alimento
//   (SchedaAlimentoCatalogo), dove c'è anche «Apri» per uno già nei tuoi.
// - Niente «+» e niente selezione: qui non si crea e non si elimina.
//
// Lo stato di ogni riga si ricalcola a ogni ridisegno sul catalogo
// dell'utente letto live dalla pagina: una copia arrivata con la sync, o
// cancellata con l'Annulla, cambia subito la riga.

import { useState } from "react";
import type { Alimento } from "@/lib/db/tipi";
import { CATALOGO_PRECARICATO, type AlimentoCatalogo } from "@/lib/catalogo/catalogoPrecaricato";
import {
  categorieCatalogo,
  elencoCatalogo,
  testoConteggioCatalogo,
} from "@/lib/catalogo/elencoCatalogo";
import { statoNelCatalogo } from "@/lib/catalogo/neiTuoi";
import { aggiungiDalCatalogo } from "@/lib/repository/alimenti";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import RigaCatalogoPrecaricato from "@/components/RigaCatalogoPrecaricato";
import SchedaAlimentoCatalogo from "@/components/SchedaAlimentoCatalogo";

// «Nascondi quelli che hai», per telefono (mockup: «si ricorda la scelta
// solo in questo telefono»). Una preferenza come il tema: Esci non la
// toglie.
export const CHIAVE_NASCONDI = "nutritrack:catalogo:nascondi-quelli-che-hai";

export const TESTO_FONTI_CATALOGO =
  "Valori da Open Food Facts (ODbL) e Ciqual 2025 (Anses, Licence Ouverte)";

const CATEGORIE = categorieCatalogo(CATALOGO_PRECARICATO);

function leggiNascondi(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CHIAVE_NASCONDI) === "1";
  } catch {
    return false;
  }
}

function scriviNascondi(valore: boolean) {
  try {
    if (valore) window.localStorage.setItem(CHIAVE_NASCONDI, "1");
    else window.localStorage.removeItem(CHIAVE_NASCONDI);
  } catch {
    // Senza localStorage (navigazione privata) la scelta vale finché la
    // pagina resta aperta.
  }
}

export default function SchedaCatalogo({
  userId,
  queryIniziale = "",
  apertaIniziale = null,
  catalogoUtente,
  puoAprire,
  onAggiunto,
  onApri,
}: {
  userId: string;
  // La ricerca già scritta (da «Vedi tutto il catalogo» in Aggiungi).
  queryIniziale?: string;
  // La scheda già aperta (da una scansione con un codice del catalogo).
  apertaIniziale?: AlimentoCatalogo | null;
  // Il catalogo locale dell'utente (catalogoLocale), letto live dalla pagina.
  catalogoUtente: Alimento[];
  puoAprire: (alimento: Alimento) => boolean;
  onAggiunto: (copia: Alimento) => void;
  onApri: (alimento: Alimento) => void;
}) {
  const [query, setQuery] = useState(queryIniziale);
  const [categoria, setCategoria] = useState<string | null>(null);
  // Letto subito: questa scheda si disegna solo dopo un tocco su
  // «Catalogo», nel browser, mai sul server (dove localStorage non c'è).
  const [nascondi, setNascondi] = useState(leggiNascondi);
  const [aperta, setAperta] = useState<AlimentoCatalogo | null>(apertaIniziale);
  // L'id del catalogo che si sta aggiungendo: quel pulsante si spegne.
  const [inCorso, setInCorso] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const elenco = elencoCatalogo(CATALOGO_PRECARICATO, catalogoUtente, userId, {
    query,
    categoria,
    nascondiQuelliCheHai: nascondi,
  });

  async function aggiungi(voce: AlimentoCatalogo) {
    if (inCorso) return;
    setInCorso(voce.id);
    setErrore(null);
    try {
      const esito = await aggiungiDalCatalogo(userId, voce);
      setAperta(null);
      // "nei-tuoi": un doppio tocco, o una copia arrivata nel frattempo con
      // la sync. Non è nato niente: nessuna barra, la riga dice già «Nei
      // tuoi».
      if (esito.esito === "aggiunto") onAggiunto(esito.alimento);
    } catch {
      setErrore("Non è stato possibile aggiungere l'alimento. Riprova.");
    } finally {
      setInCorso(null);
    }
  }

  return (
    <>
      <div className="relative">
        <Lente className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca nel catalogo"
          aria-label="Cerca nel catalogo"
          enterKeyHint="search"
          className={`h-11 w-full rounded-full border border-border bg-background pl-11 pr-11 text-base ${CLASSE_FOCUS}`}
        />
        {query !== "" && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Svuota la ricerca"
            className={`absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted ${CLASSE_FOCUS}`}
          >
            <Croce />
          </button>
        )}
      </div>

      {/* I filtri scorrono in orizzontale, fino al bordo dello schermo. */}
      <div role="group" aria-label="Categoria" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {[null, ...CATEGORIE].map((c) => {
          const attivo = c === categoria;
          return (
            <button
              key={c ?? "tutti"}
              type="button"
              aria-pressed={attivo}
              onClick={() => setCategoria(c)}
              className={`flex min-h-11 shrink-0 items-center ${CLASSE_FOCUS} rounded-full`}
            >
              <span
                className={`flex h-[34px] items-center whitespace-nowrap rounded-full border px-3.5 text-sm ${
                  attivo ? "border-foreground bg-foreground text-background" : "border-border text-foreground"
                }`}
              >
                {c ?? "Tutti"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="-mt-2 flex items-center justify-between gap-2 px-1">
        <p className="text-sm text-muted" aria-live="polite">
          {testoConteggioCatalogo(elenco, nascondi)}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={nascondi}
          onClick={() => {
            setNascondi(!nascondi);
            scriviNascondi(!nascondi);
          }}
          className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full text-sm ${CLASSE_FOCUS}`}
        >
          Nascondi quelli che hai
          <span
            aria-hidden
            className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-150 motion-reduce:transition-none ${
              nascondi ? "bg-accent-strong" : "bg-[var(--linea)]"
            }`}
          >
            <span
              style={{ boxShadow: "var(--ombra-fluttuante)" }}
              className={`absolute size-5 rounded-full bg-[var(--su-pieno)] transition-[left] duration-150 motion-reduce:transition-none ${
                nascondi ? "left-[18px]" : "left-[2px]"
              }`}
            />
          </span>
        </button>
      </div>

      {errore && (
        <p role="alert" className="-mt-2 px-1 text-sm text-danger">
          {errore}
        </p>
      )}

      {elenco.righe.length > 0 ? (
        <ul className="-mt-2">
          {elenco.righe.map(({ voce, stato }) => (
            <RigaCatalogoPrecaricato
              key={voce.id}
              voce={voce}
              neiTuoi={stato.stato === "nei-tuoi"}
              inCorso={inCorso === voce.id}
              onApriScheda={() => setAperta(voce)}
              onAggiungi={() => void aggiungi(voce)}
            />
          ))}
        </ul>
      ) : (
        <p className="px-6 pt-10 text-center text-sm leading-relaxed text-muted">
          {elenco.totale > 0 ? (
            "Li hai già tutti."
          ) : (
            <>
              Nessun alimento trovato nel catalogo.
              <br />
              Prova un altro termine di ricerca.
            </>
          )}
        </p>
      )}

      <p className="text-center text-xs leading-normal text-muted">{TESTO_FONTI_CATALOGO}</p>

      {aperta && (
        <SchedaAlimentoCatalogo
          voce={aperta}
          // Ricalcolato sul catalogo live: dopo «Aggiungi» o una sync la
          // scheda aperta dice subito «Nei tuoi».
          stato={statoNelCatalogo(aperta, catalogoUtente, userId)}
          puoAprire={puoAprire}
          inCorso={inCorso === aperta.id}
          onAggiungi={() => void aggiungi(aperta)}
          onApri={(a) => {
            setAperta(null);
            onApri(a);
          }}
          onChiudi={() => setAperta(null)}
        />
      )}
    </>
  );
}

function Lente({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function Croce() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
