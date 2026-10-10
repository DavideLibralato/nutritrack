"use client";

// Se accendere il pallino arancio sulla voce Impostazioni della tab bar
// (decisione del 10/10, mockup docs/mockups/sincronizzazione.html): solo
// per gli stati che chiedono attenzione — modifiche accantonate, accesso
// scaduto, server che rifiuta dal secondo giro fallito di fila. Mai per
// "senza rete", "in corso" o "tutto salvato". Si spegne da solo quando un
// giro finisce bene. La regola sta in statoDaMostrare (campo `pallino`);
// qui solo l'utente e lo stesso hook della pagina Sincronizzazione.

import { useUtenteId } from "../supabase/useUtente";
import { useStatoSincronizzazione } from "./useStatoSincronizzazione";

export function usePallinoSincronizzazione(): boolean {
  const userId = useUtenteId();
  const { stato } = useStatoSincronizzazione(userId);
  return stato?.pallino ?? false;
}
