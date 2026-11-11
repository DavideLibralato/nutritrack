"use client";

// La fotocamera posteriore per la scansione del codice a barre
// (PUNTO_DI_PARTENZA.md §3, "Codice a barre", "La schermata di
// scansione"). Un hook di React: una funzione che un componente chiama e
// che tiene uno stato suo (qui: la fotocamera accesa o spenta), con il
// componente che si ridisegna quando cambia.
//
// Le regole, perché una fotocamera rimasta accesa è un difetto silenzioso
// (batteria, e la spia verde dell'iPhone che resta accesa):
// - si accende solo con `avvia()`, e getUserMedia parte **dentro il
//   gestore del tocco**, senza niente prima (nessun await, nessun
//   ridisegno di React in mezzo): il tocco su Scansiona chiama
//   richiediFotocamera() e passa la richiesta già partita alla schermata;
//   "Riattiva la fotocamera" e "Torna alla fotocamera" chiamano avvia()
//   dal loro onClick. Motivo (difetto del 07/11): nell'app installata
//   dalla Home, su iPhone con iOS 18.7, Scansiona dava sempre "permesso
//   negato" senza che iOS lo chiedesse, mentre in Safari funzionava.
//   Prima getUserMedia partiva da un useEffect, cioè dopo il ridisegno,
//   fuori dal tocco. Che fosse questa la causa non è dimostrato: da qui
//   in poi l'errore vero si legge sotto il messaggio (`erroreTecnico`);
// - si spegne (tutti i track fermati) con `ferma()`, quando la schermata
//   si chiude (il componente si smonta) e quando l'app va in secondo piano
//   (visibilitychange, pagehide);
// - al ritorno in primo piano NON si riaccende da sola: lo stato è
//   "in-pausa" e la schermata mostra "Riattiva la fotocamera";
// - se il permesso arriva DOPO che la schermata si è chiusa o l'app è
//   andata in secondo piano (getUserMedia può metterci secondi, il tempo
//   di rispondere al popup), lo stream arrivato tardi si spegne subito.
//   Per questo ogni avvio ha un numero: se nel frattempo ne è partito un
//   altro, o c'è stato un ferma(), quello vecchio non vale più.

import { useCallback, useEffect, useRef, useState } from "react";

export type StatoFotocamera =
  | "spenta" // mai accesa
  | "avvio" // in attesa del permesso o del primo fotogramma
  | "attiva"
  | "in-pausa" // spenta dall'app (secondo piano, "Scrivi il codice"): si riaccende solo con un tocco
  | "negata" // permesso negato
  | "non-disponibile"; // niente fotocamera, o il browser non la offre

// Le capacità della torcia non sono ancora nei tipi standard di
// TypeScript: si leggono così.
type CapacitaConTorcia = MediaTrackCapabilities & { torch?: boolean };

// Cosa si chiede: la fotocamera posteriore, se c'è ("ideal": altrimenti
// va bene anche un'altra), senza audio.
export const VINCOLI_FOTOCAMERA: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: "environment" } },
};

// Chiede la fotocamera ADESSO, in modo sincrono: da chiamare come prima
// cosa nel gestore di un tocco. null se il browser non la offre. Il catch
// vuoto evita l'avviso "promessa rifiutata e non gestita" nell'istante fra
// la richiesta e il momento in cui avvia() la prende in mano: il rifiuto
// arriva lo stesso a chi aggancia .then/.catch dopo.
export function richiediFotocamera(): Promise<MediaStream> | null {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  const richiesta = navigator.mediaDevices.getUserMedia(VINCOLI_FOTOCAMERA);
  richiesta.catch(() => {});
  return richiesta;
}

// Da un errore di getUserMedia allo stato da mostrare, più il nome tecnico
// per la riga sotto il messaggio. Solo il permesso rifiutato
// (NotAllowedError) e il contesto non sicuro (SecurityError: pagina non in
// HTTPS, o fotocamera vietata alla pagina) dicono "permesso"; tutto il resto
// (NotFoundError: nessuna fotocamera; NotReadableError: occupata da
// un'altra app o guasta; OverconstrainedError; AbortError; TypeError; un
// errore qualunque) dice "non disponibile". Funzione pura, per i test.
export function statoDaErrore(errore: unknown): {
  stato: "negata" | "non-disponibile";
  tecnico: string;
} {
  const nome =
    errore instanceof Error || errore instanceof DOMException ? errore.name : typeof errore;
  const messaggio =
    errore instanceof Error || errore instanceof DOMException ? errore.message.trim() : "";
  return {
    stato: nome === "NotAllowedError" || nome === "SecurityError" ? "negata" : "non-disponibile",
    tecnico: messaggio ? `${nome}: ${messaggio}` : nome,
  };
}

export interface Fotocamera {
  // Da mettere sull'elemento <video> della schermata:
  // ref={fotocamera.collegaVideo}. È un "ref a funzione": React la chiama
  // con l'elemento quando compare e con null quando sparisce. Una funzione
  // e non un oggetto ref, così la schermata non tocca mai il ref interno.
  collegaVideo: (elemento: HTMLVideoElement | null) => void;
  // Il video da leggere adesso, solo se ha già un fotogramma; altrimenti null.
  fotogramma: () => HTMLVideoElement | null;
  stato: StatoFotocamera;
  // Il nome (e il messaggio) dell'ultimo errore di getUserMedia, per la
  // riga tecnica sotto il messaggio; null se non c'è stato.
  erroreTecnico: string | null;
  // `richiesta`: una getUserMedia già partita nel gestore del tocco
  // (richiediFotocamera). Senza, la chiede avvia() stessa: va bene solo se
  // avvia() è chiamata direttamente in un onClick.
  avvia: (richiesta?: Promise<MediaStream> | null) => void;
  ferma: () => void;
  // La torcia, solo se il telefono la offre (su iPhone di solito no).
  torciaDisponibile: boolean;
  torciaAccesa: boolean;
  cambiaTorcia: () => void;
}

export function useFotocamera(): Fotocamera {
  const video = useRef<HTMLVideoElement | null>(null);
  const [stato, setStato] = useState<StatoFotocamera>("spenta");
  const [erroreTecnico, setErroreTecnico] = useState<string | null>(null);
  const [torciaDisponibile, setTorciaDisponibile] = useState(false);
  const [torciaAccesa, setTorciaAccesa] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  // Il numero dell'avvio valido: cresce a ogni avvia() e a ogni ferma().
  const generazione = useRef(0);
  // Lo stato letto dentro gli ascoltatori di eventi, che non vedono quello
  // di React del giro corrente.
  const statoCorrente = useRef<StatoFotocamera>("spenta");

  const cambiaStato = useCallback((nuovo: StatoFotocamera) => {
    statoCorrente.current = nuovo;
    setStato(nuovo);
  }, []);

  // Spegne tutto, senza toccare lo stato di React.
  const spegni = useCallback(() => {
    generazione.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setTorciaDisponibile(false);
    setTorciaAccesa(false);
  }, []);

  const ferma = useCallback(() => {
    const prima = statoCorrente.current;
    spegni();
    // Solo una fotocamera accesa (o che si stava accendendo) va "in
    // pausa": un permesso negato resta negato.
    if (prima === "attiva" || prima === "avvio") cambiaStato("in-pausa");
  }, [spegni, cambiaStato]);

  const avvia = useCallback(
    (richiestaGiaPartita?: Promise<MediaStream> | null) => {
      // Prima di tutto la richiesta, se non è già partita: niente prima di
      // getUserMedia (vedi in cima).
      const richiesta = richiestaGiaPartita ?? richiediFotocamera();
      spegni();
      const mio = generazione.current;
      setErroreTecnico(null);
      if (!richiesta) {
        cambiaStato("non-disponibile");
        setErroreTecnico("navigator.mediaDevices.getUserMedia assente");
        return;
      }
      cambiaStato("avvio");
      richiesta
        .then(async (nuovo) => {
          if (mio !== generazione.current) {
            // Arrivato tardi: la schermata è chiusa, o l'app è in secondo
            // piano, o è partito un altro avvio. Si spegne subito.
            nuovo.getTracks().forEach((t) => t.stop());
            return;
          }
          stream.current = nuovo;
          const elemento = video.current;
          if (elemento) {
            elemento.srcObject = nuovo;
            // muted + playsInline (nel JSX) servono a iOS per partire senza
            // tocco e senza andare a tutto schermo. Un play() rifiutato non
            // ferma niente: il video riparte al prossimo fotogramma utile.
            await elemento.play().catch(() => {});
          }
          if (mio !== generazione.current) return;
          const traccia = nuovo.getVideoTracks()[0];
          const capacita = traccia?.getCapabilities?.() as CapacitaConTorcia | undefined;
          setTorciaDisponibile(capacita?.torch === true);
          cambiaStato("attiva");
        })
        .catch((errore: unknown) => {
          if (mio !== generazione.current) return;
          const { stato: nuovo, tecnico } = statoDaErrore(errore);
          setErroreTecnico(tecnico);
          cambiaStato(nuovo);
        });
    },
    [spegni, cambiaStato]
  );

  const cambiaTorcia = useCallback(() => {
    const traccia = stream.current?.getVideoTracks()[0];
    if (!traccia) return;
    const accesa = !torciaAccesa;
    traccia
      .applyConstraints({ advanced: [{ torch: accesa } as MediaTrackConstraintSet] })
      .then(() => setTorciaAccesa(accesa))
      .catch(() => setTorciaDisponibile(false));
  }, [torciaAccesa]);

  const collegaVideo = useCallback((elemento: HTMLVideoElement | null) => {
    video.current = elemento;
    // Il video compare dopo che lo stream è già arrivato: lo si collega.
    if (elemento && stream.current && elemento.srcObject !== stream.current) {
      elemento.srcObject = stream.current;
      elemento.play().catch(() => {});
    }
  }, []);

  const fotogramma = useCallback(() => {
    const elemento = video.current;
    // readyState 2 = HAVE_CURRENT_DATA: c'è almeno un fotogramma.
    return elemento && elemento.readyState >= 2 ? elemento : null;
  }, []);

  // Secondo piano e chiusura della pagina: si spegne. Al ritorno no.
  useEffect(() => {
    function alCambioVisibilita() {
      if (document.visibilityState === "hidden") ferma();
    }
    document.addEventListener("visibilitychange", alCambioVisibilita);
    window.addEventListener("pagehide", ferma);
    return () => {
      document.removeEventListener("visibilitychange", alCambioVisibilita);
      window.removeEventListener("pagehide", ferma);
    };
  }, [ferma]);

  // La schermata si chiude: si spegne.
  useEffect(() => spegni, [spegni]);

  return {
    collegaVideo,
    fotogramma,
    stato,
    erroreTecnico,
    avvia,
    ferma,
    torciaDisponibile,
    torciaAccesa,
    cambiaTorcia,
  };
}
