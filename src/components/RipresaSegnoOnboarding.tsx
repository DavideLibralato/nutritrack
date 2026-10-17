"use client";

// Manda al server l'esito dell'onboarding rimasto sul dispositivo
// (riprendiSegnoDellaSessione in src/lib/onboarding/segnoOnboarding.ts;
// PUNTO_DI_PARTENZA.md, sezione 3, "Onboarding"). Sta nel layout principale
// come RipresaUscita; nessuna interfaccia. Parte:
//   - all'avvio;
//   - al ritorno della rete;
//   - a ogni avviso dei giri di sincronizzazione (iscriviStatoGiri): così
//     vede la prima discesa riuscita, che rende noti gli obiettivi per la
//     rete di sicurezza, e l'utente nuovo dopo un accesso, perché ogni
//     accesso fa partire un giro.
//
// Niente useUtenteId: farebbe una sua chiamata getUser al server a ogni
// apertura, per tutti. La ripresa legge utente e segno dal cookie della
// sessione, e per un utente senza segno si ferma lì: senza Dexie e senza
// rete.

import { useEffect } from "react";
import { riprendiSegnoDellaSessione } from "@/lib/onboarding/segnoOnboarding";
import { iscriviStatoGiri } from "@/lib/sync/statoSincronizzazione";

export default function RipresaSegnoOnboarding() {
  useEffect(() => {
    void riprendiSegnoDellaSessione("avvio");
    // I giri servono solo a vedere la prima discesa riuscita: dopo un invio
    // fallito non ritentano. Ritentano l'avvio e il ritorno della rete.
    const alRitornoOnline = () => void riprendiSegnoDellaSessione("online");
    const aUnGiro = () => void riprendiSegnoDellaSessione("giro");
    window.addEventListener("online", alRitornoOnline);
    const smettiDiAscoltare = iscriviStatoGiri(aUnGiro);
    return () => {
      window.removeEventListener("online", alRitornoOnline);
      smettiDiAscoltare();
    };
  }, []);

  return null;
}
