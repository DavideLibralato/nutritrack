"use client";

// Scegliere lo username in una schermata: il valore del campo, l'esito
// mentre si scrive, quando si può salvare e il salvataggio con
// imposta_username (PUNTO_DI_PARTENZA.md §3, "Amici", "Lo username dopo
// l'accesso"). Lo usano "Scegli il tuo nome su Libra" in Amici
// (SceltaUsername) e, dal branch username-dopo-accesso, il passo
// dell'onboarding: la stessa logica con due aspetti diversi, senza
// copiarla. Il foglio di Profilo (SheetUsername) ha la sua, perché parte
// dal nome attuale.
//
// Il campo scrive già in minuscolo, come verrà salvato. Scrivere toglie
// l'errore del salvataggio precedente: riguardava il nome di prima.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOnline } from "@/lib/useOnline";
import { normalizzaUsername } from "@/lib/validazione";
import { impostaUsername } from "./nomiUtente";
import { puoSalvareUsername } from "./foglioUsername";
import { useDisponibilitaUsername } from "./useDisponibilitaUsername";
import {
  TESTO_USERNAME_IN_USO,
  TESTO_USERNAME_NON_SALVATO,
  TESTO_USERNAME_NON_VALIDO,
} from "./testiUsername";

export function useSceltaUsername(onScelto: (username: string) => void) {
  const [valore, setValore] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const online = useOnline();

  const stato = useDisponibilitaUsername(valore);
  const salvabile = puoSalvareUsername(stato, online) && !inCorso;
  const daCorreggere = stato === "non_valido" || stato === "in_uso";

  function cambia(nuovo: string) {
    setValore(nuovo.toLowerCase());
    setErrore(null);
  }

  async function salva() {
    if (!salvabile) return;
    setInCorso(true);
    setErrore(null);
    const esito = await impostaUsername(createClient(), valore);
    setInCorso(false);
    if (esito === "ok") onScelto(normalizzaUsername(valore));
    else if (esito === "occupato") setErrore(TESTO_USERNAME_IN_USO);
    else if (esito === "non_valido") setErrore(TESTO_USERNAME_NON_VALIDO);
    else setErrore(TESTO_USERNAME_NON_SALVATO);
  }

  return { valore, cambia, stato, online, salvabile, daCorreggere, inCorso, errore, salva };
}
