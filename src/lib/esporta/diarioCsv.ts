// Il file `libra-diario-AAAA-MM-GG.csv` (PUNTO_DI_PARTENZA.md §10.4,
// "Esporta i miei dati"): le voci vive del diario, da aprire in Excel o
// Numbers. Non è un backup (Importa legge solo il JSON): è il diario da
// guardare o rielaborare.
//
// Si costruisce dalla stessa raccolta del JSON (EsportazioneDati,
// raccoltaDati.ts), così le voci sono le stesse e non c'è una seconda
// lettura di Dexie con regole sue. Il nome del pasto e la marca si
// cercano solo dentro il file: pasti e pasti cancellati citati, alimenti,
// alimenti cancellati citati e del catalogo comune. Una voce del telefono
// condiviso (su un alimento di un altro utente, raccoltaDati.ts) resta
// senza marca: la marca di un altro non entra.
//
// I numeri, come in Oggi:
// - kcal della voce: Math.round(totaleVoce(voce).kcal), come la riga della
//   voce in Oggi;
// - macro della voce: totaleVoce, a un decimale (Oggi mostra i macro solo
//   come totali del giorno, a numero intero: sommare righe già arrotondate
//   all'intero perderebbe troppo);
// - grammi come salvati, fino a due decimali.
// La marca è quella di oggi dell'alimento, non quella del giorno della
// voce: la voce copia solo nome e valori (tipi.ts).
//
// Per Excel in italiano: separatore ";", virgola decimale, BOM UTF-8 in
// testa (senza, Excel legge gli accenti come Windows-1252), righe chiuse
// da CRLF, virgolette attorno ai campi con ";", virgolette o a capo.
//
// Le formule: Excel esegue un campo che comincia con "=", "+", "-" o "@"
// (e, per alcune versioni, con un tab o un a capo). Un nome alimento come
// "=HYPERLINK(...)" diventerebbe un link o un calcolo. Ogni campo di
// testo (pasto, alimento, marca) che comincia così riceve un apostrofo
// davanti: Excel lo mostra come testo e nasconde l'apostrofo.

import type { Alimento, Pasto, VoceDiario } from "../db/tipi";
import { totaleVoce } from "../totaliDiario";
import { arrotondaDecimali, numeroPerCampo } from "../numeriDecimali";
import { ordinaPerOrario } from "../pasti/validitaPasti";
import { oggiLocale } from "../dataGiorno";
import { millisecondiDi } from "../istanti";
import type { DatiEsportati } from "./formatoEsportazione";

export const INTESTAZIONE_CSV = [
  "Data",
  "Pasto",
  "Ora",
  "Alimento",
  "Marca",
  "Grammi",
  "Kcal",
  "Proteine (g)",
  "Carboidrati (g)",
  "Grassi (g)",
] as const;

// Una riga del CSV, già in testo, più l'id della voce (non va nel file:
// serve ai test per ritrovare le voci).
export interface RigaDiario {
  voceId: string;
  campi: string[];
}

function due(n: number): string {
  return String(n).padStart(2, "0");
}

// "2026-11-07" → "07/11/2026", come lo scrive un utente italiano.
function dataItaliana(iso: string): string {
  const [anno, mese, giorno] = iso.split("-");
  return `${giorno}/${mese}/${anno}`;
}

// L'ora locale del consumo, "HH:mm"; vuota se non c'è.
function oraLocale(istante: string | null): string {
  if (!istante) return "";
  const d = new Date(istante);
  if (Number.isNaN(d.getTime())) return "";
  return `${due(d.getHours())}:${due(d.getMinutes())}`;
}

export function righeDiario(dati: DatiEsportati): RigaDiario[] {
  const pasti = new Map<string, Pasto>(
    [...dati.pasti, ...dati.pasti_cancellati_citati].map((p) => [p.id, p])
  );
  const alimenti = new Map<string, Alimento>(
    [...dati.alimenti, ...dati.alimenti_cancellati_citati, ...dati.alimenti_comuni_citati].map(
      (a) => [a.id, a]
    )
  );

  // Il posto di ogni pasto nella giornata, per orario (lo stesso ordine di
  // Oggi). Le voci senza un pasto noto vanno in fondo al loro giorno.
  const posizionePasto = new Map(ordinaPerOrario([...pasti.values()]).map((p, i) => [p.id, i]));
  const posizione = (v: VoceDiario) =>
    (v.pasto_id !== null ? posizionePasto.get(v.pasto_id) : undefined) ?? Number.MAX_SAFE_INTEGER;

  // Le voci sono già quelle vive del JSON (raccoltaDati.ts): nessun filtro
  // in più qui, così il CSV non può avere una regola diversa dal JSON.
  const voci = [...dati.voci_diario].sort(
      (a, b) =>
        a.data.localeCompare(b.data) ||
        posizione(a) - posizione(b) ||
        // Per istante, non per testo: dal server arriva "+00:00" con sei
        // decimali, dal telefono "Z" con tre (millisecondiDi, istanti.ts).
        millisecondiDi(a.creato_il) - millisecondiDi(b.creato_il) ||
        a.id.localeCompare(b.id)
    );

  return voci.map((v) => {
    const totali = totaleVoce(v);
    const pasto = v.pasto_id !== null ? pasti.get(v.pasto_id) : undefined;
    const alimento = v.alimento_id !== null ? alimenti.get(v.alimento_id) : undefined;
    return {
      voceId: v.id,
      campi: [
        dataItaliana(v.data),
        testoSicuro(pasto?.nome ?? ""),
        oraLocale(v.consumato_alle),
        testoSicuro(v.nome_alimento),
        testoSicuro(alimento?.marca?.trim() ?? ""),
        numeroPerCampo(v.quantita_g, 2),
        String(Math.round(totali.kcal)),
        numeroPerCampo(arrotondaDecimali(totali.proteine, 1), 1),
        numeroPerCampo(arrotondaDecimali(totali.carboidrati, 1), 1),
        numeroPerCampo(arrotondaDecimali(totali.grassi, 1), 1),
      ],
    };
  });
}

// Un campo di testo che Excel prenderebbe per una formula riceve un
// apostrofo davanti.
const INIZIO_FORMULA = /^[=+\-@\t\r\n]/;

export function testoSicuro(testo: string): string {
  return INIZIO_FORMULA.test(testo) ? `'${testo}` : testo;
}

// Le virgolette solo dove servono, raddoppiando quelle interne.
export function campoCsv(campo: string): string {
  return /[;"\r\n]/.test(campo) ? `"${campo.replace(/"/g, '""')}"` : campo;
}

const BOM = "﻿";
const A_CAPO = "\r\n";

export function testoCsv(dati: DatiEsportati): string {
  const righe = [
    [...INTESTAZIONE_CSV],
    ...righeDiario(dati).map((r) => r.campi),
  ];
  return BOM + righe.map((campi) => campi.map(campoCsv).join(";")).join(A_CAPO) + A_CAPO;
}

export function nomeFileDiario(adesso: Date): string {
  return `libra-diario-${oggiLocale(adesso)}.csv`;
}
