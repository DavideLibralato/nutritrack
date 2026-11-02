"use client";

// TEMPORANEO, commit 4 di accesso-scaduto: si toglie con il commit 5 prima
// del merge. In Impostazioni > Informazioni dice se la prova del 401
// PGRST303 finto è attiva (fetchConScadenza.ts), così si vede dallo
// screenshot. Niente se è spenta.
//
// useSyncExternalStore legge il valore da localStorage al disegno; sul
// server (dove localStorage non c'è) è sempre null.

import { useSyncExternalStore } from "react";
import { modalitaProva303 } from "@/lib/supabase/fetchConScadenza";

const nessunaIscrizione = () => () => {};

export default function AvvisoProva303() {
  const modalita = useSyncExternalStore(nessunaIscrizione, modalitaProva303, () => null);
  if (!modalita) return null;
  return <p className="mx-4 text-xs text-warning">Prova 303: {modalita}</p>;
}
