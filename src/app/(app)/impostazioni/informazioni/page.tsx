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
// Dal branch `catalogo`, sotto, le fonti del catalogo precaricato con il
// link al file ODbL.
//
// Nessun dato dell'utente e niente da salvare: componente server, la pagina
// arriva già pronta.

import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import RigaImpostazioni from "@/components/RigaImpostazioni";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

// Il file in public/catalogo/, scritto da scripts/catalogo/generaCatalogo.mjs
// e fuori dal proxy (src/proxy.ts): si apre anche senza accesso.
const INDIRIZZO_FILE_ODBL = "/catalogo/catalogo-open-food-facts-odbl.json";

const TESTO_CIQUAL =
  "Catalogo, alimenti sfusi: Anses, Table de composition nutritionnelle des aliments Ciqual 2025, V1.0 del 19/11/2025, doi:10.57745/RDMHWY, Licence Ouverte Etalab 2.0. Nomi tradotti e valori arrotondati da Libra.";

export default function InformazioniPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+1.5rem)]">
      <IntestazioneSottopagina titolo="Informazioni" />
      <GruppoImpostazioni>
        <RigaImpostazioni etichetta="Versione" valore={process.env.VERSIONE_APP} />
        <RigaImpostazioni etichetta="Build" valore={process.env.COMMIT_APP} />
      </GruppoImpostazioni>
      <div className="mx-3.5 -mt-2 flex flex-col gap-2 text-[13px] leading-relaxed text-muted">
        <p>Dati dei prodotti: Open Food Facts, licenza ODbL</p>
        {/* Il catalogo precaricato (PUNTO_DI_PARTENZA.md §10.1, "Licenze"):
            i prodotti di marca vengono da Open Food Facts, e l'ODbL chiede
            di offrire il database che ne ricaviamo con la stessa licenza;
            gli sfusi da Ciqual, che con la Licence Ouverte chiede la
            citazione e di dire cosa è cambiato. */}
        <p>
          Catalogo, prodotti di marca: Open Food Facts, licenza ODbL.{" "}
          <a
            href={INDIRIZZO_FILE_ODBL}
            target="_blank"
            rel="noopener"
            className={`inline-flex min-h-11 items-center rounded font-medium text-accent underline underline-offset-2 ${CLASSE_FOCUS}`}
          >
            Il file con la stessa licenza
          </a>
        </p>
        <p>{TESTO_CIQUAL}</p>
      </div>
    </main>
  );
}
