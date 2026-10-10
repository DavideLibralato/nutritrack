"use client";

// La scheda di una data futura in Pasti e orari (PUNTO_DI_PARTENZA.md,
// sezione 3, "Pasti e orari", "Schede per data"; mockup
// docs/mockups/pasti-e-orari.html, "2 · Schede per data"): i pasti come
// saranno quel giorno, ognuno con la sua ora di quel giorno e l'etichetta
// del cambio ("nuovo", "nome nuovo", "ora nuova" + "prima: …"), i pasti
// che da lì non ci sono più, e i cambi di quella data con il loro Annulla
// (RigaCambio).
//
// Le righe non si toccano: le schede future non si modificano, si modifica
// sempre da "Oggi" (lo dice la nota in cima). Tutto arriva dalla pagina,
// già calcolato dalle righe di `pasti` (schedaDi): qui si legge solo,
// dal vivo, quante voci ha tolto ciascun "non ci sarà più", perché la
// riga del cambio lo dice.

import { useLiveQuery } from "dexie-react-hooks";
import type { VoceDiario } from "@/lib/db/tipi";
import type { CambioProgrammato, RigaScheda, Scheda } from "@/lib/pasti/cambiProgrammati";
import { normalizzaOra } from "@/lib/pasti/controlliPasti";
import { vociEliminateDalCambio } from "@/lib/repository/modifichePasti";
import { formattaGiornoCorto } from "@/lib/dataGiorno";
import GruppoImpostazioni from "./GruppoImpostazioni";
import RigaCambio from "./RigaCambio";

// Un cambio si riconosce dalla riga che tocca e dalla data.
function chiaveCambio(c: CambioProgrammato): string {
  return `${c.tipo}:${c.vecchia?.id ?? ""}:${c.nuova?.id ?? ""}:${c.data}`;
}

export default function VistaDataFutura({
  data,
  scheda,
  inCorso,
  onAnnulla,
}: {
  data: string;
  scheda: Scheda;
  inCorso: boolean;
  onAnnulla: (cambio: CambioProgrammato) => void;
}) {
  const giorno = formattaGiornoCorto(data);
  const eliminazioni = scheda.cambi.filter((c) => c.tipo === "elimina");
  // Le dipendenze di useLiveQuery: le chiavi dei cambi, non l'array (che è
  // nuovo a ogni disegno della pagina).
  const chiavi = eliminazioni.map(chiaveCambio).join("|");
  const vociPerCambio = useLiveQuery(async () => {
    const voci: Record<string, VoceDiario[]> = {};
    for (const c of eliminazioni) voci[chiaveCambio(c)] = await vociEliminateDalCambio(c);
    return voci;
  }, [chiavi]);

  return (
    <>
      <p className="mx-1 -mt-2 text-sm leading-snug text-muted">
        Così saranno i tuoi pasti dal {giorno}. Si modificano dalla scheda Oggi.
      </p>

      <GruppoImpostazioni
        titolo={`Dal ${giorno}`}
        nota={
          scheda.tolti.length > 0 ? (
            <>
              Non ci sarà più:{" "}
              {scheda.tolti.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ", "}
                  <s className="text-foreground">{p.nome}</s>
                </span>
              ))}
            </>
          ) : undefined
        }
      >
        {scheda.righe.map((r) => (
          <RigaPastoFuturo key={r.pasto.id} riga={r} />
        ))}
      </GruppoImpostazioni>

      <GruppoImpostazioni titolo="Cambi di questa data">
        {scheda.cambi.map((c) => (
          <RigaCambio
            key={chiaveCambio(c)}
            cambio={c}
            vociEliminate={c.tipo === "elimina" ? vociPerCambio?.[chiaveCambio(c)] : undefined}
            inCorso={inCorso}
            onAnnulla={() => onAnnulla(c)}
          />
        ))}
      </GruppoImpostazioni>
    </>
  );
}

// Una riga da leggere, senza freccia: nome con l'etichetta del cambio, e
// sotto il valore di prima; l'ora a destra.
function RigaPastoFuturo({ riga }: { riga: RigaScheda }) {
  return (
    <div className="riga-impostazioni relative flex min-h-[52px] items-center gap-2.5 px-4 py-2 text-base">
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          {riga.pasto.nome}
          {riga.etichetta && (
            <span className="ml-1.5 inline-block rounded-md bg-[var(--capsula-attiva)] px-1.5 py-px align-[2px] text-[11px] font-semibold tracking-[0.05em] text-[var(--testo-capsula)] uppercase">
              {riga.etichetta}
            </span>
          )}
        </span>
        {riga.prima && <span className="block text-sm text-muted">prima: {riga.prima}</span>}
      </span>
      <span className="shrink-0 text-[15px] text-muted">{normalizzaOra(riga.pasto.ora_inizio)}</span>
    </div>
  );
}
