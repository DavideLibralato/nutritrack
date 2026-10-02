// Swipe per cambiare giorno in Oggi (PUNTO_DI_PARTENZA.md, sezione 3,
// "Swipe per cambiare giorno"): le decisioni del gesto, senza browser e
// senza React. Numeri dentro, risposte fuori — così si testano tutte le
// soglie senza simulare un dito. L'hook che le usa è in swipeGiorno.ts.
//
// Convenzione dei segni: `dx` è lo spostamento orizzontale del dito dal
// punto di partenza. Negativo = dito verso sinistra = giorno DOPO (come
// sfogliare una pagina); positivo = dito verso destra = giorno PRIMA.

// Movimento minimo (in px, distanza dal punto di partenza) prima di decidere
// se il gesto è orizzontale o verticale. Sotto questa soglia è un tocco.
export const SOGLIA_DIREZIONE_PX = 10;
// Il gesto è orizzontale solo se |dx| supera |dy| di questo fattore
// (inclinazione massima ~34° dall'orizzontale). Altrimenti è uno scroll.
export const RAPPORTO_ORIZZONTALE = 1.5;
// Trascinamento lento: il giorno cambia oltre questa distanza.
export const DISTANZA_CAMBIO_PX = 80;
// Gesto veloce ("flick"): basta questa velocità (px/ms)...
export const VELOCITA_CAMBIO = 0.5;
// ...purché il dito abbia percorso almeno questa distanza.
export const DISTANZA_MINIMA_FLICK_PX = 30;
// Finestra su cui si misura la velocità: conta come esce il dito, non come
// è partito.
export const FINESTRA_VELOCITA_MS = 100;
// Gesti che partono così vicino ai bordi sono ignorati: in Safari lo swipe
// dal bordo sinistro è "indietro". Vale anche nell'app installata, per
// coerenza.
export const MARGINE_BORDO_PX = 24;
// Oltre oggi il pannello segue il dito solo per questa frazione (elastico).
export const RESISTENZA_ELASTICO = 0.3;
// Durate delle animazioni del pannello.
export const DURATA_USCITA_MS = 150;
export const DURATA_ENTRATA_MS = 200;
export const DURATA_RITORNO_MS = 200;

export type Direzione = "orizzontale" | "verticale";
export type EsitoSwipe = "precedente" | "successivo" | "ritorno";

// Il gesto può partire da qui? No se è entro MARGINE_BORDO_PX da un bordo.
export function partenzaValida(x: number, larghezzaSchermo: number): boolean {
  return x >= MARGINE_BORDO_PX && x <= larghezzaSchermo - MARGINE_BORDO_PX;
}

// Direzione del gesto, decisa una volta sola. `null` = non ancora: il dito
// non si è mosso abbastanza (ed è ancora un tocco).
export function decidiDirezione(dx: number, dy: number): Direzione | null {
  if (Math.hypot(dx, dy) < SOGLIA_DIREZIONE_PX) return null;
  return Math.abs(dx) > RAPPORTO_ORIZZONTALE * Math.abs(dy) ? "orizzontale" : "verticale";
}

// Di quanto si sposta il pannello per un dito spostato di `dx`. Verso il
// giorno dopo, se il giorno mostrato è già oggi (`puoAvanti` falso), segue
// il dito solo in parte: l'effetto "elastico" che dice "da qui non si va".
export function spostamentoMostrato(dx: number, puoAvanti: boolean): number {
  if (dx < 0 && !puoAvanti) return dx * RESISTENZA_ELASTICO;
  return dx;
}

export interface Campione {
  t: number; // ms
  x: number; // px
}

// Velocità orizzontale (px/ms, col segno di dx) negli ultimi
// FINESTRA_VELOCITA_MS: dal campione più vecchio dentro la finestra
// all'ultimo. Con meno di due campioni utili è 0.
export function velocitaRecente(campioni: Campione[]): number {
  if (campioni.length < 2) return 0;
  const ultimo = campioni[campioni.length - 1];
  const primo =
    campioni.find((c) => ultimo.t - c.t <= FINESTRA_VELOCITA_MS) ?? ultimo;
  const dt = ultimo.t - primo.t;
  if (dt <= 0) return 0;
  return (ultimo.x - primo.x) / dt;
}

// Cosa succede al rilascio di un gesto orizzontale.
export function esitoRilascio({
  dx,
  velocita,
  puoAvanti,
}: {
  dx: number;
  velocita: number;
  puoAvanti: boolean;
}): EsitoSwipe {
  const lontano = Math.abs(dx) >= DISTANZA_CAMBIO_PX;
  // Un flick vale solo se va nello stesso verso dello spostamento: un dito
  // che torna indietro di scatto non conferma.
  const flick =
    Math.abs(dx) >= DISTANZA_MINIMA_FLICK_PX &&
    Math.abs(velocita) >= VELOCITA_CAMBIO &&
    Math.sign(velocita) === Math.sign(dx);
  if (!lontano && !flick) return "ritorno";
  if (dx < 0) return puoAvanti ? "successivo" : "ritorno";
  return "precedente";
}

// Dopo il rilascio, il click "fantasma" del trascinamento arriva entro
// pochi millisecondi. Oltre questo tempo il blocco scade da solo.
export const SCADENZA_BLOCCO_CLICK_MS = 400;

// Il click che il browser manda dopo un trascinamento non deve aprire lo
// sheet della riga da cui è partito. Si blocca UN click, e solo quello che
// segue subito il trascinamento: il blocco si spegne al primo click, a ogni
// gesto nuovo e dopo SCADENZA_BLOCCO_CLICK_MS. Serve perché su iPhone dopo
// un trascinamento il click spesso non arriva affatto, e un blocco rimasto
// "armato" si mangerebbe il tocco successivo (o un Invio da tastiera).
// `ora` in ms (event.timeStamp), passato da fuori per poterlo testare.
export interface BloccoClick {
  inizioGesto(): void;
  trascinamentoConcluso(ora: number): void;
  // Chiamata a ogni click: true = questo va bloccato.
  consumaClick(ora: number): boolean;
}

export function creaBloccoClick(): BloccoClick {
  let armatoAlle: number | null = null;
  return {
    inizioGesto() {
      armatoAlle = null;
    },
    trascinamentoConcluso(ora) {
      armatoAlle = ora;
    },
    consumaClick(ora) {
      const blocca = armatoAlle !== null && ora - armatoAlle <= SCADENZA_BLOCCO_CLICK_MS;
      armatoAlle = null;
      return blocca;
    },
  };
}
