// I cambi programmati di Pasti e orari (passo 5, PUNTO_DI_PARTENZA.md,
// sezione 3, "Pasti e orari", "Date future"): rinominare, cambiare l'ora,
// eliminare o aggiungere un pasto "da una data" futura. Funzioni pure,
// testate in modo permanente: nessuna scrittura, solo letture delle righe
// di `pasti` già caricate.
//
// Un cambio programmato NON si salva da nessuna parte: si riconosce dalle
// righe di `pasti`, come i totali si ricalcolano dalle voci. Così le
// schede per data non possono mai dire una cosa diversa dai dati, e quando
// la data arriva il cambio sparisce da solo dall'elenco.
//
// Il FILO di un pasto: per l'utente "Pranzo" è un pasto solo, anche quando
// nel tempo diventa più righe (una per periodo: "Pranzo" fino al 12,
// "Pranzo 1" dal 13). Le righe di un filo hanno lo stesso `ordine`:
// rinominare o cambiare l'ora "da un giorno" lo copia sulla riga nuova,
// mentre un pasto aggiunto ne prende uno mai usato (prossimoOrdine, più
// alto di tutte le righe, cancellate comprese). Regola: `ordine` non si
// cambia mai su una riga esistente (sezione 4, "pasti").
//
// Riga A che finisce il giorno D−1 e riga B dello stesso filo che comincia
// il giorno D: dal giorno D il pasto cambia. Nessuna riga che continua:
// dal giorno D il pasto non c'è più. Una riga che comincia dopo oggi senza
// niente prima: un pasto nuovo da quel giorno.

import { v5 as uuidv5 } from "uuid";
import type { Pasto } from "../db/tipi";
import { eGiornoVero, formattaGiornoCorto, giornoPrecedente, giornoSuccessivo, prossimoLunedi } from "../dataGiorno";
import { chiaveNome, normalizzaOra } from "./controlliPasti";
import { pastiValidiIl } from "./validitaPasti";

// - rinomina: da D il pasto ha un nome nuovo (e magari anche un'ora nuova);
// - orario: da D cambia solo l'ora;
// - elimina: da D il pasto non c'è più;
// - nuovo: da D c'è un pasto in più.
export type TipoCambio = "rinomina" | "orario" | "elimina" | "nuovo";

export interface CambioProgrammato {
  tipo: TipoCambio;
  // Il giorno da cui vale: "YYYY-MM-DD", sempre dopo oggi.
  data: string;
  // La riga che finisce il giorno prima (rinomina, orario, elimina).
  vecchia: Pasto | null;
  // La riga che comincia quel giorno (rinomina, orario, nuovo).
  nuova: Pasto | null;
}

// Le righe dello stesso filo di `pasto`, vive. Con `cancellate`, anche le
// righe cancellate: servono a ritrovare le voci di una riga tagliata da un
// "Elimina da una data" (l'Annulla dalla scheda le cerca in tutto il filo).
export function filoDi(pasto: Pasto, righe: Pasto[], { cancellate = false } = {}): Pasto[] {
  return righe.filter(
    (r) =>
      r.user_id === pasto.user_id && r.ordine === pasto.ordine && (cancellate || r.deleted_at === null)
  );
}

// Namespace fisso dell'id di un cambio (UUID v5): generato una volta a
// caso, diverso da quelli dei giorni, dei pasti predefiniti e delle righe
// ricreate dagli Annulla.
const NAMESPACE_CAMBI = "23ec1188-1602-486d-a594-d92caa87b239";

// L'id di un cambio "da D" sulla riga `pastoId` (quella che si chiude il
// giorno D−1). Va nel segno delle voci che un "Elimina da una data"
// cancella (`voci_diario.eliminata_dal_cambio`), così l'Annulla dalla
// scheda le ritrova. Riga e data insieme, non la sola riga: la stessa riga
// si può tagliare più volte (dal 12, annullato, poi dal 14), e ogni taglio
// deve ritrovare solo le sue voci. Calcolato, non salvato: la scheda lo
// ricostruisce dalla riga chiusa, che finisce il giorno prima del cambio.
export function idCambio(pastoId: string, data: string): string {
  return uuidv5(`${pastoId}:${data}`, NAMESPACE_CAMBI);
}

function vive(righe: Pasto[]): Pasto[] {
  return righe.filter((r) => r.deleted_at === null);
}

// Rinomina o solo orario, fra la riga che finisce e quella che continua lo
// stesso filo. Stesso nome (senza badare a maiuscole e spazi, come i
// controlli) e ora diversa: solo l'orario. Nome e ora uguali non li crea
// nessuna scrittura; se capitasse (due telefoni), si mostra come rinomina.
function tipoDelPassaggio(vecchia: Pasto, nuova: Pasto): "rinomina" | "orario" {
  const stessoNome = chiaveNome(vecchia.nome) === chiaveNome(nuova.nome);
  const oraDiversa = normalizzaOra(vecchia.ora_inizio) !== normalizzaOra(nuova.ora_inizio);
  return stessoNome && oraDiversa ? "orario" : "rinomina";
}

// Tutti i cambi programmati dopo `oggi`, in ordine di data e, a parità di
// data, di orario.
export function cambiProgrammati(righe: Pasto[], oggi: string): CambioProgrammato[] {
  const tutte = vive(righe);
  const cambi: CambioProgrammato[] = [];

  for (const r of tutte) {
    const dal = r.valido_dal ?? null;
    if (dal !== null && dal > oggi) {
      const prima = giornoPrecedente(dal);
      const vecchia = filoDi(r, tutte).find((x) => (x.valido_al ?? null) === prima) ?? null;
      cambi.push(
        vecchia
          ? { tipo: tipoDelPassaggio(vecchia, r), data: dal, vecchia, nuova: r }
          : { tipo: "nuovo", data: dal, vecchia: null, nuova: r }
      );
    }
    const al = r.valido_al ?? null;
    if (al !== null && al >= oggi) {
      const dopo = giornoSuccessivo(al);
      const continua = filoDi(r, tutte).some((x) => (x.valido_dal ?? null) === dopo);
      if (!continua) cambi.push({ tipo: "elimina", data: dopo, vecchia: r, nuova: null });
    }
  }

  const ora = (c: CambioProgrammato) => normalizzaOra((c.nuova ?? c.vecchia)!.ora_inizio);
  return cambi.sort((a, b) => a.data.localeCompare(b.data) || ora(a).localeCompare(ora(b)));
}

// Le date delle schede: una per ogni data con almeno un cambio, in ordine.
export function dateProgrammate(righe: Pasto[], oggi: string): string[] {
  return [...new Set(cambiProgrammati(righe, oggi).map((c) => c.data))];
}

// Una riga della scheda di una data futura: il pasto come sarà quel
// giorno, con l'etichetta del cambio di quella data, se ne ha uno.
// `prima`: il nome di prima (rinomina) o l'ora di prima (orario).
export interface RigaScheda {
  pasto: Pasto;
  etichetta: "nuovo" | "nome nuovo" | "ora nuova" | null;
  prima: string | null;
}

export interface Scheda {
  righe: RigaScheda[];
  // I pasti che da quella data non ci sono più ("Non ci sarà più: …").
  tolti: Pasto[];
  // I cambi di quella data, ognuno col suo Annulla.
  cambi: CambioProgrammato[];
}

// La scheda "Dal lun 12 ott": i pasti validi quel giorno, in ordine
// d'orario (ognuno con la sua ora di quel giorno), e i cambi che
// cominciano proprio quel giorno.
export function schedaDi(righe: Pasto[], data: string, oggi: string): Scheda {
  const cambi = cambiProgrammati(righe, oggi).filter((c) => c.data === data);
  const righeScheda = pastiValidiIl(righe, data).map((pasto): RigaScheda => {
    const cambio = cambi.find((c) => c.nuova?.id === pasto.id);
    if (!cambio) return { pasto, etichetta: null, prima: null };
    if (cambio.tipo === "nuovo") return { pasto, etichetta: "nuovo", prima: null };
    if (cambio.tipo === "orario") {
      return { pasto, etichetta: "ora nuova", prima: normalizzaOra(cambio.vecchia!.ora_inizio) };
    }
    return { pasto, etichetta: "nome nuovo", prima: cambio.vecchia!.nome };
  });
  return {
    righe: righeScheda,
    tolti: cambi.filter((c) => c.tipo === "elimina").map((c) => c.vecchia!),
    cambi,
  };
}

// Fino a quale giorno si può scegliere "Da una data" per rinominare,
// cambiare l'ora o eliminare `pasto` (la riga valida oggi). Si parte da
// domani; senza cambi programmati non c'è un massimo (il limite dei 7
// giorni riguarda solo le voci del diario). Con un cambio già programmato
// si arriva al giorno di quel cambio, se il pasto continua (la stessa data
// modifica il cambio già programmato), o al suo ultimo giorno, se da lì
// non c'è più: oltre, il pasto ha già un altro nome o non esiste.
// `disponibile` è falso se fra domani e il massimo non c'è nessun giorno
// (il pasto finisce oggi).
export interface LimitiDaUnaData {
  min: string;
  max: string | null;
  disponibile: boolean;
  // Il cambio che fissa il massimo, per dirlo sotto il campo data.
  cambioSuccessivo: CambioProgrammato | null;
}

export function limitiDaUnaData(pasto: Pasto, righe: Pasto[], oggi: string): LimitiDaUnaData {
  const min = giornoSuccessivo(oggi);
  const al = pasto.valido_al ?? null;
  if (al === null) return { min, max: null, disponibile: true, cambioSuccessivo: null };
  const dopo = giornoSuccessivo(al);
  const cambioSuccessivo =
    cambiProgrammati(righe, oggi).find((c) => c.vecchia?.id === pasto.id && c.data === dopo) ?? null;
  const continua = cambioSuccessivo !== null && cambioSuccessivo.tipo !== "elimina";
  const max = continua ? dopo : al;
  return { min, max, disponibile: max >= min, cambioSuccessivo };
}

// La data proposta da "Da una data": il prossimo lunedì (come nel mockup),
// o l'ultimo giorno possibile se il lunedì va oltre.
export function dataProposta(limiti: LimitiDaUnaData, oggi: string): string {
  const lunedi = prossimoLunedi(oggi);
  return limiti.max !== null && lunedi > limiti.max ? limiti.max : lunedi;
}

// Cosa non va nella data scelta, o null. Un campo data col `min`/`max` non
// basta: alcuni browser lasciano digitare un giorno fuori.
export function erroreDataDaUnaData(data: string, limiti: LimitiDaUnaData): string | null {
  const dentro =
    eGiornoVero(data) && data >= limiti.min && (limiti.max === null || data <= limiti.max);
  if (dentro) return null;
  return limiti.max === null
    ? `Scegli un giorno da ${formattaGiornoCorto(limiti.min)} in poi.`
    : `Scegli un giorno fra ${formattaGiornoCorto(limiti.min)} e ${formattaGiornoCorto(limiti.max)}.`;
}
