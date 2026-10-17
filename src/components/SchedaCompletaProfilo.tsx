"use client";

// La scheda "Completa il tuo profilo" in Oggi (PUNTO_DI_PARTENZA.md,
// sezione 3, "Onboarding", "Lo faccio dopo e la scheda in Oggi"; mockup
// docs/mockups/onboarding.html, l'ultimo telefono). Per chi ha scelto "Lo
// faccio dopo": in cima alla lista dei pasti, scorre con la lista, su
// qualunque giorno (riguarda il profilo, non il giorno). "Continua" riapre
// l'onboarding dal primo passo da fare.
//
// Quando: solo con mostraScheda di statoSegno, cioè segno "rimandato", 0
// obiettivi vivi e dati noti. Con i dati non ancora noti non compare: niente
// lampo per chi gli obiettivi li ha già su un altro dispositivo. Sparisce da
// sola appena c'è un obiettivo, perché Dexie cambia; poi la ripresa manda
// "fatto".
//
// Costo, come la guardia del layout: utente e segno dal cookie e dalla
// chiave locale (utenteConSegno("rimandato")), nessuna chiamata di rete.
// Solo con il segno effettivo "rimandato" si legge Dexie; per tutti gli
// altri la scheda non legge niente.
//
// È un <li>: sta dentro la <ul> dei pasti. Non ha data-pasto-id né
// data-tieni-premuto, quindi non è un bersaglio del trascinamento e non
// apre il menu del tieni premuto; lo swipe del giorno parte anche da qui,
// come da tutto il pannello, e blocca da sé il tocco su "Continua" che
// segue uno swipe.

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { repositoryMisurazioni, repositoryObiettivi, repositoryProfili } from "@/lib/repository";
import { iscriviSegnoLocale, utenteConSegno } from "@/lib/onboarding/segnoOnboarding";
import { useStatoOnboardingPer } from "@/lib/onboarding/useStatoOnboarding";
import { cosaManca } from "@/lib/onboarding/statoOnboarding";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

const utenteRimandato = () => utenteConSegno("rimandato");

export default function SchedaCompletaProfilo() {
  const router = useRouter();
  const candidato = useSyncExternalStore(iscriviSegnoLocale, utenteRimandato, () => null);
  const stato = useStatoOnboardingPer(candidato, candidato ? "rimandato" : null);

  // Le etichette di ciò che manca, dalle stesse tre tabelle. Senza
  // candidato la query non legge niente.
  const mancano = useLiveQuery(async () => {
    if (!candidato) return undefined;
    const [profili, misurazioni, obiettivi] = await Promise.all([
      repositoryProfili.ottieniTutti(candidato),
      repositoryMisurazioni.ottieniTutti(candidato),
      repositoryObiettivi.ottieniTutti(candidato),
    ]);
    return cosaManca(profili[0] ?? null, misurazioni, obiettivi);
  }, [candidato]);

  if (!stato?.mostraScheda || !mancano || mancano.length === 0) return null;

  return (
    <li className="pt-2 pb-4">
      <section
        aria-labelledby="scheda-completa-profilo"
        className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-4"
      >
        <h2 id="scheda-completa-profilo" className="font-display text-[19px] font-bold">
          Completa il tuo profilo
        </h2>
        <p className="text-sm leading-[1.45] text-muted">
          Senza obiettivi non posso dirti quante calorie ti restano oggi.
        </p>
        <ul aria-label="Cosa manca" className="flex flex-wrap gap-1.5">
          {mancano.map((etichetta) => (
            <li
              key={etichetta}
              className="rounded-full bg-[var(--capsula-attiva)] px-2.5 py-1 text-[12.5px] font-semibold text-[var(--testo-capsula)]"
            >
              {etichetta}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => router.push("/onboarding?continua=1")}
          className={`min-h-11 w-full rounded-lg bg-accent-strong p-3 font-medium text-on-strong ${CLASSE_FOCUS}`}
        >
          Continua
        </button>
      </section>
    </li>
  );
}
