// Impostazioni > Informazioni (PUNTO_DI_PARTENZA.md, sezione 3,
// "Impostazioni"): la versione dell'app e il commit del deploy.
//
// I due valori li scrive Next nel codice durante la build (`env` in
// next.config.ts): VERSIONE_APP da package.json, COMMIT_APP dai primi 7
// caratteri di VERCEL_GIT_COMMIT_SHA, "sviluppo" in locale. Servono a capire
// quale versione gira sul telefono, per esempio dopo un deploy.
//
// Sotto, la riga della licenza dei dati dei prodotti (branch
// `codice-a-barre`, PUNTO_DI_PARTENZA.md §3, "Codice a barre", "Licenza"):
// i valori trovati con il codice a barre vengono da Open Food Facts, con
// licenza ODbL, e chi li usa deve dirlo. Una riga di testo e non una
// RigaImpostazioni: etichetta e valore insieme a 390 px non ci starebbero.
//
// Nessun dato dell'utente e niente da salvare: componente server, la pagina
// arriva già pronta.

import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import RigaImpostazioni from "@/components/RigaImpostazioni";

export default function InformazioniPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+1.5rem)]">
      <IntestazioneSottopagina titolo="Informazioni" />
      <GruppoImpostazioni>
        <RigaImpostazioni etichetta="Versione" valore={process.env.VERSIONE_APP} />
        <RigaImpostazioni etichetta="Build" valore={process.env.COMMIT_APP} />
      </GruppoImpostazioni>
      <p className="mx-3.5 -mt-2 text-[13px] text-muted">
        Dati dei prodotti: Open Food Facts, licenza ODbL
      </p>
    </main>
  );
}
