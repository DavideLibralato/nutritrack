"use client";

// L'intestazione di Profilo con il cambio della foto (PUNTO_DI_PARTENZA.md
// §3, "La foto profilo"; mockup docs/mockups/foto-profilo.html, proposta B
// e schermate 1-7). Lo stato e le chiamate stanno in useCambioFoto; qui
// solo cosa si vede:
// - il cerchio è un pulsante con la matita. Senza foto apre subito il menu
//   dell'iPhone (<input type="file" accept="image/*">, nascosto); con la
//   foto il foglio "Foto profilo" (Modifica / Elimina / Annulla);
// - offline il riquadro "Serve la connessione" sopra l'intestazione, come
//   Cambia password: compare al tocco e sparisce da solo quando torna la
//   rete. navigator.onLine su iPhone arriva in ritardo (lezione del
//   23/10): se dice "online" e la rete non c'è, ci pensa l'errore del
//   caricamento;
// - scelta la foto, il foglio "La tua foto"; dopo "Usa foto" la foto nuova
//   sbiadita con "Caricamento della foto…", poi "Foto aggiornata." in
//   basso. Non riuscito: torna la foto di prima, l'errore e "Riprova", che
//   ricarica la stessa foto già ritagliata;
// - "Elimina foto" con la sua conferma, poi "Foto eliminata.".
// Chiuso un foglio, il fuoco torna sul cerchio.

import { useEffect, useRef } from "react";
import { useOnline } from "@/lib/useOnline";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { useCambioFoto } from "@/lib/foto/useCambioFoto";
import { useIndirizzoBlob } from "@/lib/foto/useFotoProfilo";
import { azioneTocco, occupato } from "@/lib/foto/statoCambioFoto";
import {
  ETICHETTA_AGGIUNGI_FOTO,
  ETICHETTA_CAMBIA_FOTO,
  MESSAGGIO_FOTO_AGGIORNATA,
  MESSAGGIO_FOTO_ELIMINATA,
  SENZA_RETE_FOTO,
  TESTO_CARICAMENTO_FALLITO,
} from "@/lib/foto/testiFoto";
import IntestazioneProfilo from "./IntestazioneProfilo";
import SheetSceltaFoto from "./SheetSceltaFoto";
import SheetRitaglioFoto from "./SheetRitaglioFoto";
import SheetEliminaFoto from "./SheetEliminaFoto";
import BarraAnnulla from "./BarraAnnulla";

const FASI_CON_FOGLIO = new Set([
  "scelta",
  "ritaglio",
  "preparazione",
  "conferma-elimina",
  "eliminazione",
]);

export default function CambioFotoProfilo({
  userId,
  nome,
  pesoKg,
  altezzaCm,
  email,
  foto,
}: {
  userId: string | null | undefined;
  nome: string | null;
  pesoKg: number | null;
  altezzaCm: number | null;
  email: string | null;
  // La propria foto, dalla copia sul telefono (useMiaFoto).
  foto: string | null;
}) {
  const online = useOnline();
  const { stato, invia, usaFoto, riprova, confermaElimina } = useCambioFoto(userId);
  const selettore = useRef<HTMLInputElement>(null);
  const pulsante = useRef<HTMLButtonElement>(null);

  const fotoPronta =
    stato.fase === "caricamento" || stato.fase === "caricamento-fallito" ? stato.foto : null;
  const anteprima = useIndirizzoBlob(stato.fase === "caricamento" ? fotoPronta : null);

  // Chiuso un foglio, il fuoco torna sul cerchio, da dove si era partiti.
  const fasePrima = useRef(stato.fase);
  useEffect(() => {
    if (FASI_CON_FOGLIO.has(fasePrima.current) && !FASI_CON_FOGLIO.has(stato.fase)) {
      pulsante.current?.focus();
    }
    fasePrima.current = stato.fase;
  }, [stato.fase]);

  function apriSelettore() {
    // Nello stesso tocco: Safari apre il menu solo da un gesto dell'utente.
    selettore.current?.click();
  }

  function tocca() {
    const azione = azioneTocco(stato, online, Boolean(foto));
    if (azione === "senza-rete") invia({ tipo: "senza-rete" });
    else if (azione === "scelta") invia({ tipo: "apri-scelta" });
    else if (azione === "selettore") apriSelettore();
  }

  function fileScelto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Svuotato subito: scegliere di nuovo la stessa foto deve funzionare.
    e.target.value = "";
    if (file) invia({ tipo: "file-scelto", file });
  }

  const annulla = () => invia({ tipo: "annulla" });

  return (
    <>
      {stato.fase === "senza-rete" && !online && (
        <div role="status" className="rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-[15px] font-semibold">{SENZA_RETE_FOTO.titolo}</p>
          <p className="mt-0.5 text-sm leading-snug text-muted">{SENZA_RETE_FOTO.testo}</p>
        </div>
      )}

      <IntestazioneProfilo
        nome={nome}
        pesoKg={pesoKg}
        altezzaCm={altezzaCm}
        email={email}
        foto={foto}
        anteprima={anteprima}
        azioneFoto={{
          etichetta: foto ? ETICHETTA_CAMBIA_FOTO : ETICHETTA_AGGIUNGI_FOTO,
          spenta: occupato(stato) || !userId,
          onTocca: tocca,
        }}
        rifPulsanteFoto={pulsante}
      />

      <input
        ref={selettore}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden
        className="hidden"
        onChange={fileScelto}
      />

      {stato.fase === "caricamento-fallito" && (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-sm text-warning">
            {TESTO_CARICAMENTO_FALLITO}
          </p>
          <button
            type="button"
            onClick={() => void riprova()}
            className={`min-h-[46px] w-full rounded-[10px] border border-border font-semibold ${CLASSE_FOCUS}`}
          >
            Riprova
          </button>
        </div>
      )}

      {stato.fase === "foto-non-valida" && (
        <p role="alert" className="text-sm text-warning">
          {stato.testo}
        </p>
      )}

      {stato.fase === "scelta" && (
        <SheetSceltaFoto
          onModifica={() => {
            annulla();
            apriSelettore();
          }}
          onElimina={() => invia({ tipo: "chiedi-elimina" })}
          onAnnulla={annulla}
        />
      )}

      {(stato.fase === "ritaglio" || stato.fase === "preparazione") && (
        <SheetRitaglioFoto
          file={stato.file}
          inCorso={stato.fase === "preparazione"}
          onUsa={(area) => void usaFoto(area)}
          onAnnulla={annulla}
        />
      )}

      {(stato.fase === "conferma-elimina" || stato.fase === "eliminazione") && (
        <SheetEliminaFoto
          inCorso={stato.fase === "eliminazione"}
          errore={stato.fase === "conferma-elimina" ? stato.errore : null}
          onConferma={() => void confermaElimina()}
          onAnnulla={annulla}
        />
      )}

      {/* "Foto aggiornata." / "Foto eliminata.": stessa barra e stesso
          punto di "Password aggiornata." (BarraPasswordAggiornata). */}
      {stato.fase === "fatto" && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[var(--ingombro-tab-bar)] z-40 mx-auto max-w-md">
          <BarraAnnulla
            {...(stato.cosa === "aggiornata"
              ? MESSAGGIO_FOTO_AGGIORNATA
              : MESSAGGIO_FOTO_ELIMINATA)}
            onChiudi={() => invia({ tipo: "chiudi-messaggio" })}
          />
        </div>
      )}
    </>
  );
}
