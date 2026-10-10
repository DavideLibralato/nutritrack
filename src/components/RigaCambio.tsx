// Un cambio programmato nella scheda della sua data, con il suo "Annulla"
// (PUNTO_DI_PARTENZA.md, sezione 3, "Pasti e orari", "Schede per data";
// mockup docs/mockups/pasti-e-orari.html, "Cambi di questa data"):
// - "Pranzo → Pranzo 1", sotto "nome nuovo" (", alle 14:30" se cambia
//   anche l'ora);
// - "Pranzo 12:30 → 14:30", sotto "ora nuova";
// - "Nuovo pasto: Merenda", sotto "inizia alle 16:30";
// - "Pranzo non ci sarà più", sotto "4 voci eliminate, dal lun 12 ott al
//   gio 15 ott" (le voci che il suo Annulla rimette) o, senza voci, "i
//   giorni prima restano come sono".
//
// L'Annulla lo esegue la pagina (annullaCambioProgrammato): qui c'è solo il
// pulsante. Il suo nome per lo screen reader dice quale cambio annulla,
// perché nella scheda ce ne possono essere più d'uno.

import type { ReactNode } from "react";
import type { VoceDiario } from "@/lib/db/tipi";
import type { CambioProgrammato } from "@/lib/pasti/cambiProgrammati";
import { normalizzaOra } from "@/lib/pasti/controlliPasti";
import { formattaGiornoCorto } from "@/lib/dataGiorno";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

export default function RigaCambio({
  cambio,
  vociEliminate,
  inCorso,
  onAnnulla,
}: {
  cambio: CambioProgrammato;
  // Solo per "elimina": le voci col segno di quel cambio. undefined finché
  // non sono lette.
  vociEliminate?: VoceDiario[];
  inCorso: boolean;
  onAnnulla: () => void;
}) {
  const { titolo, dettaglio, descrizione } = testiCambio(cambio, vociEliminate);
  return (
    <div className="riga-impostazioni relative flex min-h-[52px] items-center gap-2.5 px-4 py-2.5">
      <div className="min-w-0 flex-1 text-[15px] leading-snug">
        <p className="break-words">{titolo}</p>
        {dettaglio && <p className="text-sm text-muted">{dettaglio}</p>}
      </div>
      <button
        type="button"
        onClick={onAnnulla}
        disabled={inCorso}
        aria-label={`Annulla: ${descrizione}`}
        className={`min-h-11 flex-none rounded-lg px-2 text-[15px] font-medium text-accent disabled:opacity-50 ${CLASSE_FOCUS}`}
      >
        Annulla
      </button>
    </div>
  );
}

function testiCambio(
  cambio: CambioProgrammato,
  vociEliminate: VoceDiario[] | undefined
): { titolo: ReactNode; dettaglio: string | null; descrizione: string } {
  const { vecchia, nuova } = cambio;
  if (cambio.tipo === "nuovo" && nuova) {
    return {
      titolo: (
        <>
          Nuovo pasto: <b className="font-semibold">{nuova.nome}</b>
        </>
      ),
      dettaglio: `inizia alle ${normalizzaOra(nuova.ora_inizio)}`,
      descrizione: `nuovo pasto ${nuova.nome}`,
    };
  }
  if (cambio.tipo === "orario" && vecchia && nuova) {
    const da = normalizzaOra(vecchia.ora_inizio);
    const a = normalizzaOra(nuova.ora_inizio);
    return {
      titolo: (
        <>
          <b className="font-semibold">{vecchia.nome}</b> {da} → {a}
        </>
      ),
      dettaglio: "ora nuova",
      descrizione: `${vecchia.nome} ${da} → ${a}`,
    };
  }
  if (cambio.tipo === "rinomina" && vecchia && nuova) {
    const ora = normalizzaOra(nuova.ora_inizio);
    const oraCambiata = ora !== normalizzaOra(vecchia.ora_inizio);
    return {
      titolo: (
        <>
          <b className="font-semibold">{vecchia.nome}</b> → <b className="font-semibold">{nuova.nome}</b>
        </>
      ),
      dettaglio: oraCambiata ? `nome nuovo, alle ${ora}` : "nome nuovo",
      descrizione: `${vecchia.nome} → ${nuova.nome}`,
    };
  }
  // elimina
  const nome = vecchia?.nome ?? "";
  return {
    titolo: (
      <>
        <b className="font-semibold">{nome}</b> non ci sarà più
      </>
    ),
    dettaglio:
      vociEliminate === undefined
        ? null
        : vociEliminate.length === 0
          ? "i giorni prima restano come sono"
          : `${vociEliminate.length} ${vociEliminate.length === 1 ? "voce eliminata" : "voci eliminate"}, ${quandoVoci(vociEliminate)}`,
    descrizione: `${nome} non ci sarà più`,
  };
}

// "del lun 12 ott" (un giorno solo), "dal lun 12 ott al gio 15 ott".
function quandoVoci(voci: VoceDiario[]): string {
  const giorni = voci.map((v) => v.data).sort();
  const primo = giorni[0];
  const ultimo = giorni[giorni.length - 1];
  return primo === ultimo
    ? `del ${formattaGiornoCorto(primo)}`
    : `dal ${formattaGiornoCorto(primo)} al ${formattaGiornoCorto(ultimo)}`;
}
