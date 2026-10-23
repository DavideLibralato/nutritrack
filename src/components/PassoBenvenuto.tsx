// Passo 1 dell'onboarding, il Benvenuto (PUNTO_DI_PARTENZA.md, sezione 3,
// "Onboarding"; mockup docs/mockups/onboarding.html, stile B). Senza la
// barra in alto: niente Indietro e niente "Dopo", il primo tocco è sempre
// "Iniziamo".
//
// L'icona è public/icons/icon-512.png, la bilancia: uguale nei due temi, e
// già salvata dal service worker, quindi si vede anche offline. Un <img>
// semplice e non next/image: il file è già della misura giusta e non va
// ottimizzato.
//
// Il nome viene dai metadati dell'account (useNomeUtente): finché non è
// letto, o se manca, il titolo è "Ciao!", mai "Ciao .".

import { useNomeUtente } from "@/lib/supabase/useUtente";
import StrutturaPasso from "./StrutturaPasso";
import { CLASSE_SOTTO } from "@/lib/onboarding/classiOnboarding";

export default function PassoBenvenuto({ onIniziamo }: { onIniziamo: () => void }) {
  const nome = useNomeUtente();

  return (
    <StrutturaPasso etichetta="Iniziamo" attivo onAvanti={onIniziamo}>
      <div className="flex flex-col pt-10">
        {/* eslint-disable-next-line @next/next/no-img-element -- vedi il commento in cima */}
        <img
          src="/icons/icon-512.png"
          alt="Libra"
          width={92}
          height={92}
          className="mb-7 size-[92px] rounded-[22%]"
        />
        <h1 className="mb-3.5 font-display text-[44px] leading-[1.08] font-bold tracking-[-0.01em] text-balance">
          {nome ? `Ciao ${nome}.` : "Ciao!"}
        </h1>
        <p className={CLASSE_SOTTO}>
          Ti do il benvenuto su Libra. Qualche domanda veloce e ti propongo quante calorie, grassi,
          carboidrati e proteine puntare ogni giorno.
        </p>
      </div>
    </StrutturaPasso>
  );
}
