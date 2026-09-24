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

// Le voci di una composizione con l'alimento ancora nel catalogo (mai
// congelato: sempre l'oggetto vivo). Un alimento può essere stato
// eliminato dal catalogo dopo aver salvato il pasto — di norma non
// succede più (src/lib/repository/composizioni.ts cancella anche la riga
// di composizioni_voci quando l'alimento sparisce, e il pasto stesso se
// era l'ultimo alimento rimasto), ma questo filtro resta come rete di
// sicurezza per i dati scritti prima di quella correzione, o non ancora
// sincronizzati da un altro dispositivo.
//
// Unica funzione che decide "un alimento di questa composizione conta
// ancora": usata sia per costruire l'elenco (pastiSalvati) sia per il
// controllo booleano (pastoSalvatoVisibile) — scritta una volta sola
// perché le due cose non possono più dare risposte diverse (bug del
// 2026-09-22: una composizione con l'unico alimento cancellato dal
// catalogo era "invisibile" qui ma "esistente" per
// esisteComposizioneConNome, che la guardava con un filtro separato).
function vociValidePerComposizione(
  composizioneId: string,
  catalogo: Alimento[],
  composizioniVoci: ComposizioneVoce[]
): { alimento: Alimento; quantitaG: number }[] {
  return composizioniVoci
    .filter((v) => v.composizione_id === composizioneId)
    .sort((a, b) => a.ordine - b.ordine)
    .map((v) => {
      const alimento = catalogo.find((a) => a.id === v.alimento_id);
      return alimento ? { alimento, quantitaG: v.quantita_g } : null;
    })
    .filter((x): x is { alimento: Alimento; quantitaG: number } => x !== null);
}

export function pastiSalvati(
  catalogo: Alimento[],
  composizioni: Composizione[],
  composizioniVoci: ComposizioneVoce[]
): PastoSalvato[] {
  const risultato: PastoSalvato[] = [];

  for (const c of composizioni) {
    if (c.tipo !== "pasto_salvato") continue;

    const voci = vociValidePerComposizione(c.id, catalogo, composizioniVoci);

    // Se non resta nessun alimento valido, il pasto salvato non ha più
    // niente da aggiungere: non compare.
    if (voci.length === 0) continue;

    risultato.push({ composizioneId: c.id, nome: c.nome, voci });
  }

  return risultato.sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

// Un pasto salvato "esiste" per l'utente solo se gli resta almeno un
// alimento valido — stessa regola di pastiSalvati(), riusata qui perché la
// serve anche esisteComposizioneConNome (src/lib/repository/composizioni.ts):
// un nome non va considerato "già preso" da una composizione che in
// Preferiti non compare più.
export function pastoSalvatoVisibile(
  composizioneId: string,
  catalogo: Alimento[],
  composizioniVoci: ComposizioneVoce[]
): boolean {
  return vociValidePerComposizione(composizioneId, catalogo, composizioniVoci).length > 0;
}

// Gli id delle composizioni (solo pasto_salvato) i cui alimenti+quantità
// coincidono esattamente col pasto di oggi. Di norma una sola, ma niente
// vieta di aver salvato lo stesso contenuto due volte con nomi diversi:
// tornano tutte, così toglierlo dai preferiti (sezione 3, punto 3 delle
// correzioni) li rimuove tutti, non solo il primo trovato.
//
// Serve il catalogo per passare da vociValidePerComposizione — non per i
// valori nutrizionali (il confronto guarda solo alimento_id e quantità), ma
// perché una voce con l'alimento cancellato dal catalogo non deve contare:
// altrimenti la stessa composizione risulta di N alimenti qui e di N-1 in
// pastiSalvati(), a seconda di chi la guarda (bug del 2026-09-24, visto su
// cbd1ae1a: la stella "già salvato" e l'elenco in Preferiti in disaccordo —
// stesso difetto già corretto fra pastiSalvati() ed esisteComposizioneConNome,
// sfuggito qui). Nessun altro punto nel progetto legge composizioni_voci
// senza passare da vociValidePerComposizione (verificato).
export function composizioniCorrispondenti(
  vociPasto: { alimento_id: string | null; quantita_g: number }[],
  catalogo: Alimento[],
  composizioni: Composizione[],
  composizioniVoci: ComposizioneVoce[]
): string[] {
  if (vociPasto.length === 0) return [];
  const chiavePasto = chiaveMultiset(vociPasto);

  return composizioni
    .filter((c) => c.tipo === "pasto_salvato")
    .filter((c) => {
      const voci = vociValidePerComposizione(c.id, catalogo, composizioniVoci).map((v) => ({
        alimento_id: v.alimento.id,
        quantita_g: v.quantitaG,
      }));
      return voci.length === vociPasto.length && chiaveMultiset(voci) === chiavePasto;
    })
    .map((c) => c.id);
}

// Il pasto di oggi corrisponde già a (almeno) un pasto salvato? Serve alla
// stella dell'icona "Salva come preferito" in Oggi.
export function pastoGiaSalvato(
  vociPasto: { alimento_id: string | null; quantita_g: number }[],
  catalogo: Alimento[],
  composizioni: Composizione[],
  composizioniVoci: ComposizioneVoce[]
): boolean {
  return (
    composizioniCorrispondenti(vociPasto, catalogo, composizioni, composizioniVoci).length > 0
  );
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
