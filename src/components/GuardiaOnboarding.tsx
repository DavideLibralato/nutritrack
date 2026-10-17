"use client";

// La guardia dell'onboarding (PUNTO_DI_PARTENZA.md, sezione 3,
// "Onboarding", "Dove sta la pagina e perché la guardia è nel client"):
// chi ha l'onboarding da fare e apre una pagina con la tab bar (Oggi,
// Statistiche, Impostazioni) va a /onboarding. È il caso della ripresa
// (app chiusa a metà) e del primo accesso con la conferma email accesa;
// subito dopo "Crea account" ci porta già la Server Action.
//
// Non disegna niente e non blocca la pagina: Oggi compare intanto, e il
// suo lampo alla ripresa è accettato.
//
// Nessuna chiamata di rete, per nessuno:
//   - utente e segno vengono dal cookie della sessione e da localStorage
//     (utenteConOnboardingDaFare), non da getUser;
//   - solo se il segno effettivo è "da_fare" passa l'utente al cuore di
//     useStatoOnboarding, che legge Dexie (profili, misurazioni,
//     obiettivi) per la rete di sicurezza. Per tutti gli altri passa null,
//     e il cuore non legge niente.
// La decisione è quella di statoSegno, la stessa della pagina /onboarding:
// la guardia manda lì solo chi la pagina fa entrare, così non c'è un giro
// infinito fra "/" e "/onboarding".
//
// Il redirect parte una volta sola per montaggio (useRef): un nuovo giro
// di disegno, o un cambio dei dati, non lo rifà.

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { iscriviSegnoLocale, utenteConOnboardingDaFare } from "@/lib/onboarding/segnoOnboarding";
import { useStatoOnboardingPer } from "@/lib/onboarding/useStatoOnboarding";

export default function GuardiaOnboarding() {
  const router = useRouter();
  // Si rilegge quando cambia la chiave locale (per esempio "fatto" appena
  // scritto). Il terzo argomento è il valore durante il disegno sul
  // server, dove cookie e localStorage non ci sono.
  const candidato = useSyncExternalStore(iscriviSegnoLocale, utenteConOnboardingDaFare, () => null);
  const stato = useStatoOnboardingPer(candidato, candidato ? "da_fare" : null);

  const giaPortato = useRef(false);
  const mostra = stato?.mostraOnboarding === true;
  useEffect(() => {
    if (!mostra || giaPortato.current) return;
    giaPortato.current = true;
    router.replace("/onboarding");
  }, [mostra, router]);

  return null;
}
