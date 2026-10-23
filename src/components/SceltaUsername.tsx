"use client";

// "Scegli il tuo nome su Libra" (PUNTO_DI_PARTENZA.md §3, "Amici"; mockup
// docs/mockups/amici.html, schermata 3): al posto della pagina Amici per chi
// non ha ancora una riga in nomi_utente. Campo con la "@" ed esito mentre si
// scrive (CampoUsername); "Continua" chiama imposta_username. La logica sta
// in useSceltaUsername, condivisa con il passo dell'onboarding.
//
// Il campo parte vuoto. Fino al 23/10 partiva con lo username dei metadati
// dell'account, scritto in Registrati: tolto con il branch
// username-dopo-accesso, perché nessun account l'aveva senza la riga in
// nomi_utente e gli account nuovi non l'avranno.

import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { useSceltaUsername } from "@/lib/amici/useSceltaUsername";
import { TESTO_USERNAME_SENZA_RETE, testoStatoUsername } from "@/lib/amici/testiUsername";
import CampoUsername from "./CampoUsername";

export default function SceltaUsername({ onScelto }: { onScelto: (username: string) => void }) {
  const scelta = useSceltaUsername(onScelto);

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-4">
      <h2 className="font-display text-lg font-bold">Scegli il tuo nome su Libra</h2>
      <p className="text-sm text-muted">
        Gli amici ti trovano solo con il nome esatto. Potrai cambiarlo da Profilo.
      </p>

      {/* Niente etichetta visibile "Username": il campo ha l'aria-label, e
          il titolo sopra dice già cosa scrivere. */}
      <CampoUsername
        id="scelta-nome-utente"
        ariaLabel="Il tuo nome su Libra"
        enterKeyHint="go"
        valore={scelta.valore}
        onCambia={scelta.cambia}
        onInvio={() => void scelta.salva()}
        esito={
          scelta.errore ??
          (scelta.online ? testoStatoUsername(scelta.stato, "quando continui") : TESTO_USERNAME_SENZA_RETE)
        }
        tono={
          scelta.errore || scelta.daCorreggere
            ? "avviso"
            : scelta.stato === "disponibile"
              ? "positivo"
              : "neutro"
        }
        invalido={scelta.daCorreggere}
      />

      <button
        type="button"
        onClick={() => void scelta.salva()}
        disabled={!scelta.salvabile}
        className={`w-full rounded-lg bg-accent-strong p-3 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
      >
        {scelta.inCorso ? "Salvo..." : "Continua"}
      </button>
    </section>
  );
}
