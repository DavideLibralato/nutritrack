// Helper specifici per i pasti salvati, oltre al CRUD generico di
// repositoryComposizioni/repositoryComposizioniVoci. Solo `tipo:
// "pasto_salvato"` in questo pezzo — le ricette (stessa tabella, tipo
// "ricetta") sono un perimetro diverso, non ancora costruito.

import { repositoryComposizioni, repositoryComposizioniVoci } from "./index";
import type { Composizione, ComposizioneVoce, VoceDiario } from "../db/tipi";

// Un nome già usato da un altro pasto salvato (stesso confronto: trim, non
// case-insensitive — "Colazione" e "colazione" restano nomi diversi finché
// l'utente non li scrive uguali). Solo fra i "pasto_salvato": una ricetta con
// lo stesso nome non è un conflitto, sono cose diverse per l'utente.
export function esisteComposizioneConNome(
  nome: string,
  composizioni: Composizione[]
): boolean {
  const nomeTrim = nome.trim();
  return composizioni.some((c) => c.tipo === "pasto_salvato" && c.nome.trim() === nomeTrim);
}

// Promuove le voci di un pasto già registrato oggi a una composizione
// riutilizzabile (PUNTO_DI_PARTENZA.md, sezione 3: "Salvare un pasto
// intero" — non si costruisce in una schermata apposta, si promuove da una
// giornata già registrata). Copia alimento_id e quantita_g delle voci
// **al momento del salvataggio**, non un riferimento che seguirebbe
// eventuali modifiche fatte dopo alle voci di oggi.
export async function salvaPastoComeComposizione(
  userId: string,
  nome: string,
  vociPasto: VoceDiario[]
): Promise<void> {
  // In pratica alimento_id è sempre valorizzato (ogni percorso di
  // inserimento lo imposta), ma il tipo lo ammette nullable: le righe senza
  // alimento non hanno nulla da copiare in composizioni_voci, che invece
  // lo richiede.
  const vociConAlimento = vociPasto.filter(
    (v): v is VoceDiario & { alimento_id: string } => v.alimento_id !== null
  );

  const composizione = await repositoryComposizioni.crea({
    user_id: userId,
    nome,
    tipo: "pasto_salvato",
    alimento_id: null,
  });

  await Promise.all(
    vociConAlimento.map((v, indice) =>
      repositoryComposizioniVoci.crea({
        user_id: userId,
        composizione_id: composizione.id,
        alimento_id: v.alimento_id,
        quantita_g: v.quantita_g,
        ordine: indice,
      })
    )
  );
}

// Toglie un pasto salvato dai preferiti (sezione 3, punto 3 delle
// correzioni: ripremere la stella già piena lo rimuove). Cancellazione
// logica su composizione e sue voci insieme — altrimenti le voci restano
// "vive" ma orfane, invisibili nella UI ma comunque righe in giro.
export async function eliminaComposizione(
  composizioneId: string,
  composizioniVoci: ComposizioneVoce[]
): Promise<void> {
  const voci = composizioniVoci.filter((v) => v.composizione_id === composizioneId);
  await Promise.all(voci.map((v) => repositoryComposizioniVoci.elimina(v.id)));
  await repositoryComposizioni.elimina(composizioneId);
}
