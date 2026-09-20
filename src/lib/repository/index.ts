// Un repository per ciascuna delle 9 tabelle (PUNTO_DI_PARTENZA.md, sezione
// 4). Le pagine importeranno da qui, mai da src/lib/db direttamente.
//
// Esempio d'uso (quando ci saranno le pagine):
//   const pasti = await repositoryPasti.ottieniTutti(userId);
//   await repositoryVociDiario.crea({ user_id: userId, alimento_id, ... });

import { db } from "../db/database";
import { creaRepository } from "./repository";
import type {
  Profilo,
  Obiettivo,
  ObiettivoTarget,
  Pasto,
  Alimento,
  VoceDiario,
  Composizione,
  ComposizioneVoce,
  Misurazione,
  Preferito,
} from "../db/tipi";

export const repositoryProfili = creaRepository<Profilo>(db.profili, "profili");
export const repositoryObiettivi = creaRepository<Obiettivo>(
  db.obiettivi,
  "obiettivi"
);
export const repositoryObiettiviTarget = creaRepository<ObiettivoTarget>(
  db.obiettivi_target,
  "obiettivi_target"
);
export const repositoryPasti = creaRepository<Pasto>(db.pasti, "pasti");
export const repositoryAlimenti = creaRepository<Alimento>(
  db.alimenti,
  "alimenti"
);
export const repositoryVociDiario = creaRepository<VoceDiario>(
  db.voci_diario,
  "voci_diario"
);
export const repositoryComposizioni = creaRepository<Composizione>(
  db.composizioni,
  "composizioni"
);
export const repositoryComposizioniVoci = creaRepository<ComposizioneVoce>(
  db.composizioni_voci,
  "composizioni_voci"
);
export const repositoryMisurazioni = creaRepository<Misurazione>(
  db.misurazioni,
  "misurazioni"
);
export const repositoryPreferiti = creaRepository<Preferito>(
  db.preferiti,
  "preferiti"
);
