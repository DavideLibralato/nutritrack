"use client";

// Scegliere lo username in una schermata: il valore del campo, l'esito
// mentre si scrive, quando si può salvare e il salvataggio con
// imposta_username (PUNTO_DI_PARTENZA.md §3, "Amici", "Lo username dopo
// l'accesso"). Lo usano "Scegli il tuo nome su Libra" in Amici
// (SceltaUsername) e il passo dell'onboarding (PassoUsername): la stessa
// logica con due aspetti diversi, senza copiarla. Il foglio di Profilo
// (SheetUsername) ha la sua, perché parte dal nome attuale.
//
// Il campo scrive già in minuscolo, come verrà salvato. Scrivere toglie
// l'errore del salvataggio precedente: riguardava il nome di prima.
//
// Il nome salvato con successo resta ricordato (`salvato`). Serve
// all'onboarding, dove dopo il salvataggio si va avanti e con Indietro si
// torna qui: per il database quel nome è "preso" (da te), e senza questa
// regola sotto il campo comparirebbe "già in uso" sul tuo stesso nome. Con
// statoNelFoglio diventa "È già il tuo nome.", e salvarlo di nuovo va
// avanti senza chiamare il server.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOnline } from "@/lib/useOnline";
import { normalizzaUsername } from "@/lib/validazione";
import { impostaUsername, type EsitoImpostaUsername } from "./nomiUtente";
import { puoSalvareUsername, statoNelFoglio } from "./foglioUsername";
import { useDisponibilitaUsername } from "./useDisponibilitaUsername";
import {
  TESTO_NOME_IN_USO,
  TESTO_USERNAME_NON_SALVATO,
  TESTO_USERNAME_NON_VALIDO,
} from "./testiUsername";

export function useSceltaUsername(onScelto: (username: string) => void) {
  const [valore, setValore] = useState("");
  const [salvato, setSalvato] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  // L'esito dell'ultimo salvataggio non riuscito: l'onboarding, con
  // "errore" (la risposta non è arrivata), offre di saltare il passo.
  const [esitoFallito, setEsitoFallito] = useState<EsitoImpostaUsername | null>(null);
  const online = useOnline();

  const stato = statoNelFoglio(useDisponibilitaUsername(valore), valore, salvato);
  const giaSalvato = stato === "attuale";
  const salvabile = (giaSalvato || puoSalvareUsername(stato, online)) && !inCorso;
  const daCorreggere = stato === "non_valido" || stato === "in_uso";

  function cambia(nuovo: string) {
    setValore(nuovo.toLowerCase());
    setErrore(null);
    setEsitoFallito(null);
  }

  async function salva() {
    if (!salvabile) return;
    if (giaSalvato) {
      onScelto(salvato!);
      return;
    }
    setInCorso(true);
    setErrore(null);
    setEsitoFallito(null);
    const esito = await impostaUsername(createClient(), valore);
    setInCorso(false);
    if (esito === "ok") {
      const nome = normalizzaUsername(valore);
      setSalvato(nome);
      onScelto(nome);
      return;
    }
    setEsitoFallito(esito);
    if (esito === "occupato") setErrore(TESTO_NOME_IN_USO);
    else if (esito === "non_valido") setErrore(TESTO_USERNAME_NON_VALIDO);
    else setErrore(TESTO_USERNAME_NON_SALVATO);
  }

  return {
    valore,
    cambia,
    stato,
    online,
    salvabile,
    daCorreggere,
    inCorso,
    errore,
    esitoFallito,
    salva,
  };
}

// Quello che l'hook restituisce: PassoUsername lo riceve così dalla pagina,
// che tiene l'hook acceso anche quando il passo non si vede (il campo
// ritrova il suo valore tornando indietro).
export type SceltaUsernameInCorso = ReturnType<typeof useSceltaUsername>;
