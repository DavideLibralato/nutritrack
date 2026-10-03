"use client";

// Impostazioni > Aspetto (PUNTO_DI_PARTENZA.md, sezione 3, "Impostazioni" e
// sezione 7; passo "tema" del 3/10). Chiaro / Scuro / Sistema, come nel
// mockup docs/mockups/impostazioni.html. Il colore principale arriva con il
// passo successivo.
//
// La scelta si applica subito al tocco: niente Salva e niente guardiano
// delle modifiche. Sta nel localStorage di questo dispositivo, non
// nell'account (src/lib/tema.ts).

import { useSceltaTema } from "@/lib/useSceltaTema";
import { salvaSceltaTema } from "@/lib/tema";
import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import SelettoreTema from "@/components/SelettoreTema";

export default function AspettoPage() {
  const scelta = useSceltaTema();

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
    </main>
  );
}
