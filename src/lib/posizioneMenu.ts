// Dove si apre il menu contestuale di Oggi (MenuContestuale, PUNTO_DI_
// PARTENZA.md, sezione 3, "Tieni premuto"): calcolo puro, senza browser,
// così le regole si testano con numeri.
//
// - Sotto la riga se ci sta, altrimenti sopra: non deve mai finire sotto
//   "+ Aggiungi" e la pillola della tab bar (`limiteBasso`, la y in px da
//   cui comincia quella fascia) né fuori dallo schermo.
// - Non copre la riga: resta visibile quale alimento o pasto si sta
//   toccando, e il dito che ha aperto il menu non ci sta sopra.
// - In orizzontale parte dal bordo sinistro della riga, dentro i margini
//   laterali della pagina.
// Solo se non ci sta né sotto né sopra (un menu più alto dello spazio
// libero: con tre voci non succede) si schiaccia dentro lo spazio
// disponibile, anche sopra la riga.

export const DISTANZA_DALLA_RIGA_PX = 8;
export const MARGINE_LATERALE_PX = 16;
export const MARGINE_ALTO_PX = 8;

export interface Rettangolo {
  top: number;
  bottom: number;
  left: number;
}

export interface PosizioneMenu {
  top: number;
  left: number;
  verso: "sotto" | "sopra";
}

export function posizioneMenu({
  riga,
  larghezzaMenu,
  altezzaMenu,
  larghezzaSchermo,
  limiteBasso,
}: {
  riga: Rettangolo;
  larghezzaMenu: number;
  altezzaMenu: number;
  larghezzaSchermo: number;
  limiteBasso: number;
}): PosizioneMenu {
  const left = Math.max(
    MARGINE_LATERALE_PX,
    Math.min(riga.left, larghezzaSchermo - MARGINE_LATERALE_PX - larghezzaMenu)
  );
  const fondoMassimo = limiteBasso - DISTANZA_DALLA_RIGA_PX;

  const sotto = riga.bottom + DISTANZA_DALLA_RIGA_PX;
  if (sotto + altezzaMenu <= fondoMassimo) return { top: sotto, left, verso: "sotto" };

  const sopra = riga.top - DISTANZA_DALLA_RIGA_PX - altezzaMenu;
  if (sopra >= MARGINE_ALTO_PX) return { top: sopra, left, verso: "sopra" };

  const top = Math.max(MARGINE_ALTO_PX, Math.min(sopra, fondoMassimo - altezzaMenu));
  return { top, left, verso: "sopra" };
}
