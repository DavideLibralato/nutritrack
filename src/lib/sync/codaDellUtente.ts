// La coda outbox vista da un utente, per l'indicatore in Impostazioni >
// Sincronizzazione (PUNTO_DI_PARTENZA.md, sezione 9.2, "L'indicatore").
// Dal 10/10/2026.
//
// Solo le voci di quell'utente: i dati locali non si cancellano all'uscita
// (sezione 9.6), quindi su un dispositivo usato da due persone la coda può
// contenere anche le modifiche dell'altro. Come modificheNonInviate in
// ripristino.ts, si riconoscono da dati.user_id.
//
// Qui solo letture e una scrittura sulla coda in Dexie: la pagina non
// tocca Dexie direttamente (sezione 9.2, il livello repository).

import { db } from "../db/database";
import type { NomeTabella, RigaBase } from "../db/tipi";
import type { VoceOutbox } from "./outbox";
import type { RiassuntoCoda } from "./statoSincronizzazione";

export async function vociInCodaDellUtente(userId: string): Promise<VoceOutbox[]> {
  const voci = await db.outbox.toArray();
  return voci.filter((v) => v.dati.user_id === userId);
}

// Funzione pura: quante in attesa, da quando (la più vecchia), quante
// accantonate.
export function riassuntoCoda(voci: VoceOutbox[]): RiassuntoCoda {
  const inAttesa = voci.filter((v) => !v.sospesa_il);
  return {
    inAttesa: inAttesa.length,
    inAttesaDal: inAttesa.map((v) => v.creato_il).sort()[0] ?? null,
    accantonate: voci.length - inAttesa.length,
  };
}

// "Riprova a salvarle": rimette in coda le voci accantonate di QUESTO
// utente, come nuove (nessun tentativo, non più sospese). Testo e status
// dell'ultimo errore restano finché un giro non li riscrive o la voce non
// parte. Restituisce quante ne ha rimesse in coda. Chi la chiama fa poi
// partire un giro: se il server le rifiuta ancora, dopo 5 rifiuti tornano
// accantonate.
export async function riprovaAccantonate(userId: string): Promise<number> {
  return db.outbox
    .filter((v) => v.dati.user_id === userId && Boolean(v.sospesa_il))
    .modify({ sospesa_il: null, tentativi: 0 });
}

// --- Le voci accantonate, in parole dell'utente --------------------------------

// Che cosa è la modifica, al singolare: "Voce del diario", "Pasto"...
const TIPO_VOCE: Record<NomeTabella, string> = {
  voci_diario: "Voce del diario",
  pasti: "Pasto",
  alimenti: "Alimento",
  composizioni: "Pasto salvato",
  composizioni_voci: "Alimento di un pasto salvato",
  preferiti: "Preferito",
  profili: "Profilo",
  obiettivi: "Obiettivo",
  obiettivi_target: "Obiettivo",
  giorni: "Tipo di giornata",
  misurazioni: "Misurazione",
};

export interface VoceAccantonata {
  id: string;
  tipo: string;
  // Il dettaglio che fa riconoscere la modifica: «Merenda», "Yogurt,
  // Pranzo". Null se la tabella non ha un nome da mostrare.
  dettaglio: string | null;
  // ISO: quando è stata fatta la modifica (creato_il della voce).
  modificataIl: string;
  // Per "Dettagli tecnici".
  tabella: NomeTabella;
  tentativi: number;
  status: number | null;
  errore: string | null;
}

type DatiConNome = RigaBase & { nome?: unknown; nome_alimento?: unknown; pasto_id?: unknown };

function testo(valore: unknown): string | null {
  return typeof valore === "string" && valore.trim() !== "" ? valore : null;
}

// Il nome dei pasti, per le voci di diario: la voce ha solo pasto_id. Una
// lettura sola per tutte. Un pasto che non c'è più in Dexie non toglie la
// voce dall'elenco: resta il nome dell'alimento.
export async function vociAccantonate(voci: VoceOutbox[]): Promise<VoceAccantonata[]> {
  const accantonate = voci
    .filter((v) => v.sospesa_il)
    .sort((a, b) => a.creato_il.localeCompare(b.creato_il));
  const idPasti = [
    ...new Set(
      accantonate
        .filter((v) => v.tabella === "voci_diario")
        .map((v) => testo((v.dati as DatiConNome).pasto_id))
        .filter((id): id is string => id !== null)
    ),
  ];
  const pasti = await db.pasti.bulkGet(idPasti);
  const nomePasto = new Map(idPasti.map((id, i) => [id, pasti[i]?.nome ?? null]));

  return accantonate.map((v) => {
    const dati = v.dati as DatiConNome;
    let dettaglio: string | null = null;
    if (v.tabella === "voci_diario") {
      const pasto = nomePasto.get(testo(dati.pasto_id) ?? "") ?? null;
      dettaglio = [testo(dati.nome_alimento), pasto].filter(Boolean).join(", ") || null;
    } else if (testo(dati.nome)) {
      dettaglio = `«${testo(dati.nome)}»`;
    }
    return {
      id: v.id,
      tipo: TIPO_VOCE[v.tabella],
      dettaglio,
      modificataIl: v.creato_il,
      tabella: v.tabella,
      tentativi: v.tentativi,
      status: v.ultimo_status ?? null,
      errore: v.ultimo_errore,
    };
  });
}
