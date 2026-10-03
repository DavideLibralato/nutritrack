"use client";

// La parte del Salva comune a Profilo e Obiettivi (PUNTO_DI_PARTENZA.md,
// sezione 3, "Un solo Salva"): la barra Salva in fondo (solo con modifiche
// da salvare), "Salvato." dopo un salvataggio riuscito e lo sheet "cambio
// vero o correzione?" quando serve. Stato e azioni arrivano da
// useModuloImpostazioni.
//
// Va messo come ultimo figlio del <main> della pagina: la barra è sticky
// con `order-last` e resta sopra la pillola della tab bar per tutta la
// pagina.

import BarraSalvaProfilo from "./BarraSalvaProfilo";
import BarraAnnulla from "./BarraAnnulla";
import SheetCambioObiettivo from "./SheetCambioObiettivo";
import { MESSAGGIO_SALVATO } from "@/lib/inserimento/testiBarra";
import type { ModuloImpostazioni } from "@/lib/profilo/useModuloImpostazioni";

export default function SalvataggioModulo({ modulo }: { modulo: ModuloImpostazioni }) {
  return (
    <>
      <BarraSalvaProfilo
        sezioni={modulo.sezioni}
        inCorso={modulo.inCorso}
        messaggio={modulo.messaggioBarra}
        onAnnulla={modulo.annullaModifiche}
        onSalva={modulo.avviaSalvataggio}
      />

      {/* Stesso punto della barra Salva: il contenitore parte dalla cima della
          pillola (--ingombro-tab-bar) e il margine in fondo della
          BarraAnnulla (0.75rem) è --spazio-fra-barre. z-40 come in Oggi. */}
      {modulo.barraSalvato && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[var(--ingombro-tab-bar)] z-40 mx-auto max-w-md">
          <BarraAnnulla
            key={modulo.barraSalvato}
            {...MESSAGGIO_SALVATO}
            onChiudi={modulo.chiudiBarraSalvato}
          />
        </div>
      )}

      {modulo.sheet.aperto && (
        <SheetCambioObiettivo
          inizioPeriodo={modulo.sheet.inizioPeriodo}
          limiti={modulo.sheet.limiti}
          inCorso={modulo.inCorso}
          errore={modulo.sheet.errore}
          onAnnulla={modulo.sheet.chiudi}
          onConferma={modulo.sheet.conferma}
        />
      )}
    </>
  );
}
