"use client";

// Barra temporanea in basso: un messaggio breve, e facoltativamente un'azione
// ("Annulla"). Compare DOPO che qualcosa è successo — a differenza dell'avviso
// dentro SheetNome, che compare PRIMA e chiede conferma. Oggi la usano:
// - /aggiungi, dopo la cancellazione di un alimento, con "Annulla" (regola
//   "Alimenti cancellati" in PUNTO_DI_PARTENZA.md, punto 4);
// - Oggi, dopo ogni inserimento nel diario, con "Annulla" (punto 10.2);
// - Oggi, dopo "Elimina" dal menu del tieni-premuto, con "Annulla"
//   (sezione 3, "Tieni premuto");
// - Profilo, "Salvato." dopo un salvataggio riuscito, senza azione;
// - Oggi, al tocco della stella su un pasto il cui contenuto è già salvato
//   (punto 3), senza azione.
//
// Aspetto (sezione 7): una pillola dello stesso "vetro" della tab bar
// (classe .vetro, bordo, --ombra-fluttuante), larga quanto il contenuto e
// centrata, al massimo quanto lo schermo meno 16 px per lato. Se il testo va
// a capo diventa un rettangolo molto arrotondato: il raggio è fisso, pari a
// metà dell'altezza di una riga sola. Da sinistra:
// - `icona`, in un cerchio: spunta su fondo accento (andato a buon fine),
//   freccia ↶ (annullato), cestino (eliminato) o "i" (tutto il resto, il
//   predefinito) su fondo neutro. Tipi e scelta in testiBarra.ts;
// - il testo: `testo` (il verbo), `nome` in evidenza e troncato con "…" su
//   una riga sola, `coda` (il dettaglio) sempre visibile. Senza `nome`,
//   `testo` va a capo se serve (i messaggi lunghi e rari, come gli avvisi
//   del ripristino);
// - l'azione, in colore accento dentro una capsula (--capsula-attiva), con
//   il testo in --testo-capsula: l'accento appena più scuro, per il contrasto.
//   L'area toccabile è alta 44 px anche se la capsula si vede più piccola.
// Sul bordo basso, una linea sottile (.linea-tempo in globals.css) si
// accorcia in `durataMs`: mostra quanto manca prima che la barra sparisca.
//
// Se l'utente non fa niente, dopo `durataMs` chiama onChiudi e sparisce: non
// succede nient'altro. Il conto alla rovescia si ferma mentre il dito/mouse
// è sopra la barra o qualcosa dentro ha il fuoco da tastiera — un tempo che
// scade mentre qualcuno sta per premere è la cosa più frustrante che una
// barra così possa fare. Quando la pausa finisce riprende da quanto
// restava, non da capo (dal 3/10): un tocco per sbaglio non deve allungare
// la barra, né tocchi ripetuti tenerla aperta. Il calcolo sta in
// tempoBarra.ts (funzioni pure, con test).
//
// Timer e linea leggono lo stesso stato (`tempo`), quindi non vanno fuori
// passo. A ogni pausa e ripresa la linea si ridisegna (cambia la sua `key`)
// con un animation-delay NEGATIVO pari al tempo già passato: un'animazione
// con ritardo negativo parte "come se fosse cominciata prima", cioè dalla
// lunghezza che corrisponde al tempo rimasto, e arriva a zero proprio
// quando scatta il timer. In pausa resta ferma lì (animation-play-state).
//
// Posizione: `absolute`, ancorata al fondo del contenitore in cui la si
// mette (il chiamante gli dà `relative`). Non ha un suo `fixed` apposta: in
// /aggiungi il contenitore è il <main>, già agganciato al visual viewport con
// useAreaVisibile (src/lib/areaVisibile.ts, stesso meccanismo degli sheet),
// quindi la barra sta sopra la tastiera di iOS insieme a tutta la pagina.
// `sopra`: invece di stare nel fondo del contenitore, sta appena sopra di
// esso (in Oggi: sopra "+ Aggiungi", senza coprirlo).
// `margineHome`: aggiunge sotto lo spazio della barretta home di iOS
// (env(safe-area-inset-bottom)) — serve dove il contenitore arriva fino al
// bordo dello schermo, non dove sotto c'è già qualcosa che lo gestisce.
//
// Concetto React: la `key` che il chiamante dà a questo componente. Cambiarla
// (un nuovo messaggio) fa ripartire il componente da zero, timer compreso,
// invece di continuare il conto alla rovescia del messaggio precedente.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { DURATE_BARRA, type IconaBarra } from "@/lib/inserimento/testiBarra";
import {
  avviaTempo,
  pausaTempo,
  riprendiTempo,
  tempoRimasto,
  type TempoBarra,
} from "@/lib/inserimento/tempoBarra";

interface Props {
  testo: string;
  nome?: string;
  coda?: string;
  icona?: IconaBarra;
  azione?: { etichetta: string; onClick: () => void };
  durataMs?: number;
  onChiudi: () => void;
  sopra?: boolean;
  margineHome?: boolean;
}

export default function BarraAnnulla({
  testo,
  nome,
  coda,
  icona = "info",
  azione,
  // Le durate stanno in testiBarra.ts: con "Annulla" un po' di più, per il
  // tempo di decidere.
  durataMs = azione ? DURATE_BARRA.conAzione : DURATE_BARRA.senzaAzione,
  onChiudi,
  sopra = false,
  margineHome = false,
}: Props) {
  const [tempo, setTempo] = useState<TempoBarra>(() => avviaTempo(durataMs, Date.now()));
  // Le due cose che mettono in pausa, il dito (o il mouse) e il fuoco: in
  // pausa finché almeno una c'è. In ref e non in stato perché due eventi
  // possono arrivare di fila prima che React ridisegni.
  const rifDito = useRef(false);
  const rifFuoco = useRef(false);

  // onChiudi tenuto in un ref: la pagina che ospita la barra si ridisegna
  // spesso (useLiveQuery), e se il timer dipendesse direttamente da
  // onChiudi ripartirebbe da capo ogni volta che la funzione cambia identità
  // — la barra non sparirebbe mai finché i dati si muovono.
  const rifOnChiudi = useRef(onChiudi);
  useEffect(() => {
    rifOnChiudi.current = onChiudi;
  }, [onChiudi]);

  useEffect(() => {
    if (tempo.partitoAlle === null) return;
    const timer = setTimeout(() => rifOnChiudi.current(), tempoRimasto(tempo, Date.now()));
    return () => clearTimeout(timer);
  }, [tempo]);

  function cambia(dito: boolean, fuoco: boolean) {
    rifDito.current = dito;
    rifFuoco.current = fuoco;
    const ora = Date.now();
    setTempo((t) => (dito || fuoco ? pausaTempo(t, ora) : riprendiTempo(t, ora)));
  }

  const inPausa = tempo.partitoAlle === null;
  // Quanto della linea è già passato quando è stata ridisegnata l'ultima
  // volta: il ritardo negativo dell'animazione.
  const passatoMs = tempo.durataMs - tempo.rimanenteMs;

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-40 px-4 ${
        sopra ? "bottom-full" : "bottom-0"
      } ${margineHome ? "pb-[calc(1rem+env(safe-area-inset-bottom))]" : "pb-3"}`}
    >
      {/* role="status": gli screen reader leggono il testo quando compare,
          senza spostare il fuoco da dove l'utente si trova. */}
      <div
        role="status"
        onPointerEnter={() => cambia(true, rifFuoco.current)}
        onPointerLeave={() => cambia(false, rifFuoco.current)}
        onFocus={() => cambia(rifDito.current, true)}
        onBlur={() => cambia(rifDito.current, false)}
        style={
          {
            boxShadow: "var(--ombra-fluttuante)",
            "--durata-barra": `${durataMs}ms`,
          } as CSSProperties
        }
        className={`vetro pointer-events-auto relative mx-auto flex min-h-[3.25rem] w-fit max-w-[min(28rem,100%)] items-center gap-2.5 overflow-hidden rounded-[1.625rem] border border-border py-1 pl-3 text-sm text-foreground ${
          azione ? "pr-1" : "pr-4"
        }`}
      >
        <Icona tipo={icona} />
        {nome === undefined ? (
          <p className="min-w-0 py-1.5 leading-snug">{testo}</p>
        ) : (
          <p className="flex min-w-0 gap-1 whitespace-nowrap">
            <span className="shrink-0">{testo}</span>
            <span className="min-w-0 truncate font-medium">{nome}</span>
            {coda && <span className="shrink-0">{coda}</span>}
          </p>
        )}
        {azione && (
          // L'area toccabile è tutto il pulsante, alto 44 px; la capsula
          // dentro è solo il disegno.
          <button
            type="button"
            onClick={azione.onClick}
            className={`flex min-h-11 shrink-0 items-center rounded-full px-1 ${CLASSE_FOCUS}`}
          >
            <span className="rounded-full bg-[var(--capsula-attiva)] px-3 py-1 font-medium text-[var(--testo-capsula)]">
              {azione.etichetta}
            </span>
          </button>
        )}
        <span
          key={`${tempo.rimanenteMs}-${tempo.partitoAlle}`}
          aria-hidden
          style={{
            animationDelay: `-${passatoMs}ms`,
            animationPlayState: inPausa ? "paused" : "running",
          }}
          className="linea-tempo pointer-events-none absolute inset-x-0 bottom-0 h-0.5"
        />
      </div>
    </div>
  );
}

// Icona nel cerchio a sinistra, 26 px. Colori solo da token: la spunta
// "bianca" (`text-on-strong`) sul cerchio `bg-accent-strong`, che resta
// verde scuro anche al buio; le icone neutre sono del colore del testo su
// --linea.
function Icona({ tipo }: { tipo: IconaBarra }) {
  const successo = tipo === "spunta";
  const tratto = {
    width: 14,
    height: 14,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <span
      aria-hidden
      className={`grid size-[26px] shrink-0 place-items-center rounded-full ${
        successo ? "bg-accent-strong text-on-strong" : "bg-[var(--linea)] text-foreground"
      }`}
    >
      {tipo === "spunta" && (
        <svg {...tratto}>
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      )}
      {tipo === "annulla" && (
        <svg {...tratto}>
          <path d="M5.5 3.5L2.5 6.5l3 3" />
          <path d="M2.5 6.5h7a3.5 3.5 0 010 7H7" />
        </svg>
      )}
      {tipo === "elimina" && (
        <svg {...tratto} strokeWidth={1.75}>
          <path d="M2.5 4.5h11" />
          <path d="M6 4.5V3h4v1.5" />
          <path d="M4 4.5l.7 8.5h6.6l.7-8.5" />
        </svg>
      )}
      {tipo === "info" && (
        <svg {...tratto}>
          <path d="M8 7.5v4.5" />
          <path d="M8 4.5v.01" />
        </svg>
      )}
    </span>
  );
}
