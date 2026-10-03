"use client";

// Impostazioni > Aspetto (PUNTO_DI_PARTENZA.md, sezione 3, "Impostazioni" e
// sezione 7; passi "tema" e "accento" del 3/10). Il tema Chiaro / Scuro /
// Sistema (mockup docs/mockups/impostazioni.html) e il colore principale
// (mockup docs/mockups/colore-principale.html).
//
// Le scelte si applicano subito al tocco: niente Salva e niente guardiano
// delle modifiche. Stanno nel localStorage di questo dispositivo, non
// nell'account (src/lib/tema.ts).

import { useSceltaAccento, useSceltaTema } from "@/lib/useSceltaTema";
import { ACCENTI, salvaSceltaAccento, salvaSceltaTema } from "@/lib/tema";
import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import SelettoreTema from "@/components/SelettoreTema";
import SelettoreAccento from "@/components/SelettoreAccento";

export default function AspettoPage() {
  const scelta = useSceltaTema();
  const accento = useSceltaAccento();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+1.5rem)]">
      <IntestazioneSottopagina titolo="Aspetto" />

      <GruppoImpostazioni
        titolo="Tema"
        nota={
          <>
            <p>
              Con “Sistema” l’app segue la modalità chiara o scura dell’iPhone, anche quando
              cambia da sola la sera.
            </p>
            <p className="mt-2">
              Nell’app aggiunta alla schermata Home, la barra in alto con l’ora segue sempre la
              modalità dell’iPhone, non questa scelta.
            </p>
          </>
        }
      >
        <SelettoreTema scelta={scelta} onCambia={salvaSceltaTema} />
      </GruppoImpostazioni>

      <GruppoImpostazioni
        titolo="Colore principale"
        nota="Colora l'anello, i pulsanti e la voce attiva. L'arancio resta per quando superi un obiettivo."
      >
        <SelettoreAccento accenti={ACCENTI} scelta={accento} onCambia={salvaSceltaAccento} />
      </GruppoImpostazioni>
    </main>
  );
}
