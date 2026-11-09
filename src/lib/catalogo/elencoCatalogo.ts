// L'elenco della scheda «Catalogo» di Impostazioni > Alimenti
// (PUNTO_DI_PARTENZA.md §10.1; mockup docs/mockups/catalogo-precaricato.html,
// schermata 1): ricerca, filtro per categoria, «Nascondi quelli che hai» e
// la riga del conteggio. Funzioni pure, con i test in elencoCatalogo.test.ts.
//
// - La ricerca è su nome **e** marca («Barilla» trova i suoi prodotti),
//   con il confronto di sempre (testoConfronto: maiuscole, accenti e spazi
//   indifferenti). In Aggiungi la ricerca resta sul solo nome (Davide,
//   08/11).
// - L'ordine è quello del file: per categoria, come l'ha scritto Davide.
// - Lo stato di ogni riga («Aggiungi» o «Nei tuoi») è statoNelCatalogo.

import type { Alimento } from "../db/tipi";
import type { AlimentoCatalogo } from "./catalogoPrecaricato";
import { testoConfronto } from "./doppioniAlimenti";
import { statoNelCatalogo, type StatoNelCatalogo } from "./neiTuoi";

export interface RigaCatalogo {
  voce: AlimentoCatalogo;
  stato: StatoNelCatalogo;
}

export interface FiltriCatalogo {
  query: string;
  // null = «Tutti».
  categoria: string | null;
  nascondiQuelliCheHai: boolean;
}

export interface ElencoCatalogo {
  righe: RigaCatalogo[];
  // Quante righe ci sono con ricerca e categoria, prima di «Nascondi».
  totale: number;
  // Di quelle, quante sono già nei tuoi.
  giaNeiTuoi: number;
}

// Le categorie nell'ordine in cui compaiono nel catalogo, senza ripetizioni.
export function categorieCatalogo(catalogo: readonly AlimentoCatalogo[]): string[] {
  return [...new Set(catalogo.map((a) => a.categoria))];
}

export function trovaNelCatalogo(voce: AlimentoCatalogo, query: string): boolean {
  const q = testoConfronto(query);
  if (!q) return true;
  return testoConfronto(voce.marca ? `${voce.nome} ${voce.marca}` : voce.nome).includes(q);
}

export function elencoCatalogo(
  catalogo: readonly AlimentoCatalogo[],
  catalogoUtente: Alimento[],
  userId: string,
  filtri: FiltriCatalogo
): ElencoCatalogo {
  const trovate = catalogo
    .filter((v) => filtri.categoria === null || v.categoria === filtri.categoria)
    .filter((v) => trovaNelCatalogo(v, filtri.query))
    .map((voce) => ({ voce, stato: statoNelCatalogo(voce, catalogoUtente, userId) }));
  const giaNeiTuoi = trovate.filter((r) => r.stato.stato === "nei-tuoi").length;
  return {
    righe: filtri.nascondiQuelliCheHai ? trovate.filter((r) => r.stato.stato === "da-aggiungere") : trovate,
    totale: trovate.length,
    giaNeiTuoi,
  };
}

// Il riquadro «Nel catalogo» di Aggiungi (PUNTO_DI_PARTENZA.md §10.1;
// mockup, schermata 3): compare solo quando la ricerca fra i tuoi alimenti
// e i pasti salvati non trova niente (lo decide la pagina). Qui: gli
// alimenti del catalogo che quella ricerca troverebbe, con la regola di
// Aggiungi (solo il nome, come cercaPerNome, ordinati per nome), tolti
// quelli che hai già, al massimo `massimo`.
export function suggerimentiCatalogo(
  catalogo: readonly AlimentoCatalogo[],
  catalogoUtente: Alimento[],
  userId: string,
  query: string,
  massimo = 3
): AlimentoCatalogo[] {
  const q = testoConfronto(query);
  if (!q) return [];
  return catalogo
    .filter((v) => testoConfronto(v.nome).includes(q))
    .filter((v) => statoNelCatalogo(v, catalogoUtente, userId).stato === "da-aggiungere")
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"))
    .slice(0, massimo);
}

// La riga sotto i filtri, a sinistra (mockup): «183 · 2 già nei tuoi»,
// solo «183» se non ne hai nessuno; con «Nascondi» acceso «5 da
// aggiungere» («1 da aggiungere»).
export function testoConteggioCatalogo(elenco: ElencoCatalogo, nascondi: boolean): string {
  if (nascondi) return `${elenco.righe.length} da aggiungere`;
  if (elenco.giaNeiTuoi === 0) return String(elenco.totale);
  return `${elenco.totale} · ${elenco.giaNeiTuoi} già nei tuoi`;
}
