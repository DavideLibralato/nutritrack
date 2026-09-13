// Pasti salvati nella sezione "Preferiti" di Aggiungi alimento
// (PUNTO_DI_PARTENZA.md, sezione 3 e 4: "la sezione Preferiti della UI
// mostra l'unione delle due cose" — alimenti singoli e composizioni, pur
// essendo dati diversi). Solo `tipo: "pasto_salvato"`: le ricette sono un
// perimetro diverso.
//
// Funzione pura, stesso stile di recenti.ts/preferiti.ts: valori
// nutrizionali sempre dal catalogo vivo, mai congelati.

import type { Alimento, Composizione, ComposizioneVoce } from "../db/tipi";

export interface PastoSalvato {
  composizioneId: string;
  nome: string;
  // Ordine rispettato da composizioni_voci.ordine.
  voci: { alimento: Alimento; quantitaG: number }[];
}

export function pastiSalvati(
  catalogo: Alimento[],
  composizioni: Composizione[],
  composizioniVoci: ComposizioneVoce[]
): PastoSalvato[] {
  const risultato: PastoSalvato[] = [];

  for (const c of composizioni) {
    if (c.tipo !== "pasto_salvato") continue;

    const voci = composizioniVoci
      .filter((v) => v.composizione_id === c.id)
      .sort((a, b) => a.ordine - b.ordine)
      .map((v) => {
        const alimento = catalogo.find((a) => a.id === v.alimento_id);
        return alimento ? { alimento, quantitaG: v.quantita_g } : null;
      })
      // Un alimento può essere stato eliminato dal catalogo dopo aver
      // salvato il pasto: quella riga sparisce, non tutto il pasto.
      .filter((x): x is { alimento: Alimento; quantitaG: number } => x !== null);

    // Se non resta nessun alimento valido, il pasto salvato non ha più
    // niente da aggiungere: non compare.
    if (voci.length === 0) continue;

    risultato.push({ composizioneId: c.id, nome: c.nome, voci });
  }

  return risultato.sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

// Gli id delle composizioni (solo pasto_salvato) i cui alimenti+quantità
// coincidono esattamente col pasto di oggi. Di norma una sola, ma niente
// vieta di aver salvato lo stesso contenuto due volte con nomi diversi:
// tornano tutte, così toglierlo dai preferiti (sezione 3, punto 3 delle
// correzioni) li rimuove tutti, non solo il primo trovato. Solo sugli id:
// non serve il catalogo, il confronto non guarda i valori nutrizionali.
export function composizioniCorrispondenti(
  vociPasto: { alimento_id: string | null; quantita_g: number }[],
  composizioni: Composizione[],
  composizioniVoci: ComposizioneVoce[]
): string[] {
  if (vociPasto.length === 0) return [];
  const chiavePasto = chiaveMultiset(vociPasto);

  return composizioni
    .filter((c) => c.tipo === "pasto_salvato")
    .filter((c) => {
      const voci = composizioniVoci.filter((v) => v.composizione_id === c.id);
      return voci.length === vociPasto.length && chiaveMultiset(voci) === chiavePasto;
    })
    .map((c) => c.id);
}

// Il pasto di oggi corrisponde già a (almeno) un pasto salvato? Serve alla
// stella dell'icona "Salva come preferito" in Oggi.
export function pastoGiaSalvato(
  vociPasto: { alimento_id: string | null; quantita_g: number }[],
  composizioni: Composizione[],
  composizioniVoci: ComposizioneVoce[]
): boolean {
  return composizioniCorrispondenti(vociPasto, composizioni, composizioniVoci).length > 0;
}

// Confronto per multiset: ordine irrilevante, ma due righe uguali (stesso
// alimento, stessa quantità, inserite separatamente invece che come
// un'unica voce con quantità doppia) contano due volte anche nella
// composizione salvata — non si schiacciano come farebbe un Set. Quantità
// diverse, anche di poco, non corrispondono: sono sempre digitate a mano,
// mai calcolate, quindi non c'è uno scarto "da arrotondamento" da tollerare.
function chiaveMultiset(voci: { alimento_id: string | null; quantita_g: number }[]): string {
  return voci
    .map((v) => `${v.alimento_id}:${v.quantita_g}`)
    .sort()
    .join("|");
}
