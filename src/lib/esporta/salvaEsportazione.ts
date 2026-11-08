// I due salvataggi della pagina Esporta (PUNTO_DI_PARTENZA.md §10.4): il
// JSON, che aggiorna il promemoria, e il CSV, che non lo aggiorna (non è
// un backup). Il testo arriva già pronto: si chiamano dal tocco sul
// pulsante, e salvaFile arriva alla condivisione senza attese
// (condividiFile.ts).

import { salvaFile, TIPO_CSV, TIPO_JSON, type AmbienteSalvataggio, type EsitoSalvataggio } from "./condividiFile";
import { segnaEsportazione } from "./ultimaEsportazione";

export function salvaJson(
  ambiente: AmbienteSalvataggio,
  userId: string,
  nome: string,
  testo: string,
  adesso: () => Date = () => new Date()
): Promise<EsitoSalvataggio> {
  return salvaFile(ambiente, nome, testo, TIPO_JSON).then((esito) => {
    // Solo a salvataggio riuscito: annullato, errore o impossibile non
    // contano.
    if (esito.esito === "salvato") segnaEsportazione(userId, adesso());
    return esito;
  });
}

export function salvaCsv(
  ambiente: AmbienteSalvataggio,
  nome: string,
  testo: string
): Promise<EsitoSalvataggio> {
  return salvaFile(ambiente, nome, testo, TIPO_CSV);
}
