"use client";

// "Disponibile / già in uso" mentre si scrive lo username ("Scegli il tuo
// nome su Libra" in Amici e nell'onboarding, e il cambio da Profilo;
// PUNTO_DI_PARTENZA.md §3, mockup docs/mockups/amici.html). Fino al branch
// username-dopo-accesso anche nella pagina Registrati.
//
// Due regole, tutte e due con un test permanente:
// - si chiede al server solo quando l'utente smette di scrivere per
//   ATTESA_MS: una domanda per ogni tasto sarebbe uno spreco, e farebbe
//   lampeggiare l'esito;
// - vale solo la risposta per il nome scritto adesso. Le risposte possono
//   arrivare fuori ordine (la prima, lenta, dopo la seconda): senza questa
//   regola il "Disponibile" di un nome vecchio coprirebbe il "già in uso"
//   di quello nuovo.
//
// Senza rete l'esito è "errore": non è né libero né preso, e al
// salvataggio decide comunque imposta_username, che sa dire "occupato".

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizzaUsername, usernameValido } from "@/lib/validazione";
import { controllaDisponibilita, type Disponibilita } from "./nomiUtente";

export const ATTESA_MS = 400;

// "vuoto": campo vuoto, niente da dire. "controllo": il nome è nel formato
// giusto e la risposta non è ancora arrivata.
export type StatoUsername = "vuoto" | "controllo" | Disponibilita;

type Controlla = (nome: string) => Promise<Disponibilita>;

const controllaSulServer: Controlla = (nome) => controllaDisponibilita(createClient(), nome);

// `controlla` si cambia solo nei test, per decidere quando e come risponde
// il "server".
export function useDisponibilitaUsername(
  valore: string,
  controlla: Controlla = controllaSulServer
): StatoUsername {
  const nome = normalizzaUsername(valore);
  const formatoGiusto = usernameValido(valore);

  // L'ultima risposta arrivata, con il nome a cui si riferisce.
  const [risposta, setRisposta] = useState<{ nome: string; esito: Disponibilita } | null>(null);
  // L'ultimo nome chiesto al server: una risposta per un altro nome arriva
  // tardi e si scarta.
  const ultimoChiesto = useRef<string | null>(null);

  useEffect(() => {
    if (!formatoGiusto) return;
    const timer = setTimeout(() => {
      ultimoChiesto.current = nome;
      void controlla(nome).then((esito) => {
        if (ultimoChiesto.current === nome) setRisposta({ nome, esito });
      });
    }, ATTESA_MS);
    return () => clearTimeout(timer);
  }, [nome, formatoGiusto, controlla]);

  // Lo stato si ricava qui, a ogni disegno, invece di essere scritto
  // nell'effetto: così vuoto e formato sbagliato si vedono subito, senza
  // aspettare, e non resta mai a schermo l'esito di un nome precedente.
  if (nome === "") return "vuoto";
  if (!formatoGiusto) return "non_valido";
  if (risposta && risposta.nome === nome) return risposta.esito;
  return "controllo";
}
