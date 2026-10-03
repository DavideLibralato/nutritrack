"use client";

// Impostazioni > Profilo (PUNTO_DI_PARTENZA.md, sezione 3, "Profilo" e
// "Impostazioni"). Restano qui solo i dati personali (sesso, data di
// nascita, altezza, livello di attività) e l'email in sola lettura.
// Obiettivo, target e giorni di allenamento sono in Impostazioni >
// Obiettivi (passo "obiettivi"), la pesata in Impostazioni > Peso (passo
// "peso").
//
// Stile a gruppi come l'elenco, con i campi nella riga (decisione B).
//
// UN SOLO SALVA, nella barra in fondo: stato, esiti e guardiano delle
// modifiche non salvate stanno in useModuloImpostazioni (condiviso con
// Obiettivi), la logica di scrittura in src/lib/profilo/salvataggioProfilo.ts.
// La pagina modifica solo i dati personali: le altre sezioni restano quelle
// caricate e il Salva non le scrive. Sotto i campi cambiati c'è il valore di
// prima; il gruppo ha il bordo d'accento e "Modificato".

import { useNomeUtente, useEmailUtente } from "@/lib/supabase/useUtente";
import { useModuloImpostazioni } from "@/lib/profilo/useModuloImpostazioni";
import type { LivelloAttivita, Sesso } from "@/lib/db/tipi";
import { oggiLocale, formattaDataBreve } from "@/lib/dataGiorno";
import { numeriUguali, type ValoriModulo } from "@/lib/profilo/salvataggioProfilo";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import IntestazioneProfilo from "@/components/IntestazioneProfilo";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import RigaCampo from "@/components/RigaCampo";
import SelettoreSegmenti from "@/components/SelettoreSegmenti";
import ValorePrecedente from "@/components/ValorePrecedente";
import SalvataggioModulo from "@/components/SalvataggioModulo";

// "Non indicato" a schermo, per stare nel selettore a tre segmenti; lo
// screen reader legge la frase intera.
const OPZIONI_SESSO: { valore: Sesso; etichetta: string; etichettaAccessibile?: string }[] = [
  { valore: "maschio", etichetta: "Uomo" },
  { valore: "femmina", etichetta: "Donna" },
  {
    valore: "non_indicato",
    etichetta: "Non indicato",
    etichettaAccessibile: "Preferisco non indicarlo",
  },
];

const OPZIONI_ATTIVITA: { valore: LivelloAttivita; etichetta: string }[] = [
  { valore: "sedentario", etichetta: "Sedentario" },
  { valore: "leggero", etichetta: "Leggero (1-3 allenamenti a settimana)" },
  { valore: "moderato", etichetta: "Moderato (3-5 allenamenti a settimana)" },
  { valore: "attivo", etichetta: "Attivo (6-7 allenamenti a settimana)" },
  { valore: "molto_attivo", etichetta: "Molto attivo (lavoro fisico o due allenamenti al giorno)" },
];

const CLASSE_MAIN =
  "mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+var(--spazio-fra-barre))]";

// Il campo dentro una riga: casella crema allineata a destra, come RigaCampo.
const CLASSE_CAMPO_RIGA = `rounded-lg border border-border bg-background px-2 py-1.5 text-right text-base ${CLASSE_FOCUS}`;

function etichettaDi<T extends string>(opzioni: { valore: T; etichetta: string }[], valore: T | "") {
  return opzioni.find((o) => o.valore === valore)?.etichetta ?? "Non impostato";
}

export default function ProfiloPage() {
  const modulo = useModuloImpostazioni();
  const nome = useNomeUtente();
  const email = useEmailUtente();

  if (!modulo.pronto || !modulo.prima || !modulo.ora || !modulo.m) {
    return (
      <main className={CLASSE_MAIN}>
        <IntestazioneSottopagina titolo="Profilo" />
        <p className="text-sm text-muted">Caricamento...</p>
      </main>
    );
  }

  const { prima, ora, m, errori, profilo, ultimaPesata } = modulo;
  const dp = { prima: prima.datiPersonali, ora: ora.datiPersonali };

  function aggiornaDati(campi: Partial<ValoriModulo["datiPersonali"]>) {
    modulo.aggiorna({ ...ora, datiPersonali: { ...ora.datiPersonali, ...campi } });
  }

  return (
    <main className={CLASSE_MAIN}>
      <IntestazioneSottopagina titolo="Profilo" />
      <IntestazioneProfilo
        nome={nome}
        pesoKg={ultimaPesata?.valore ?? null}
        altezzaCm={profilo?.altezza_cm ?? null}
        email={email}
      />

      <GruppoImpostazioni
        titolo="Dati personali"
        modificato={m.datiPersonali}
        errore={errori.datiPersonali}
        nota="Servono per calcolare la proposta di obiettivi."
      >
        <div className="riga-impostazioni relative px-4 py-3">
          <span className="mb-2 block text-base">Sesso</span>
          <SelettoreSegmenti
            etichetta="Sesso"
            segmenti={OPZIONI_SESSO}
            valore={dp.ora.sesso}
            onCambia={(sesso) => aggiornaDati({ sesso })}
          />
          <ValorePrecedente
            visibile={dp.prima.sesso !== dp.ora.sesso}
            valore={etichettaDi(OPZIONI_SESSO, dp.prima.sesso)}
          />
        </div>

        <div className="riga-impostazioni relative px-4 py-2.5">
          <div className="flex min-h-8 items-center gap-3">
            <label htmlFor="profilo-data-nascita" className="min-w-0 flex-1 text-base">
              Data di nascita
            </label>
            <input
              id="profilo-data-nascita"
              type="date"
              value={dp.ora.dataNascita}
              onChange={(e) => aggiornaDati({ dataNascita: e.target.value })}
              max={oggiLocale()}
              className={CLASSE_CAMPO_RIGA}
            />
          </div>
          <div className="text-right">
            <ValorePrecedente
              visibile={dp.prima.dataNascita !== dp.ora.dataNascita}
              valore={dp.prima.dataNascita ? formattaDataBreve(dp.prima.dataNascita) : ""}
            />
          </div>
        </div>

        <RigaCampo
          id="profilo-altezza"
          etichetta="Altezza"
          unita="cm"
          valore={dp.ora.altezzaCm}
          precedente={dp.prima.altezzaCm}
          cambiato={!numeriUguali(dp.prima.altezzaCm, dp.ora.altezzaCm)}
          onChange={(altezzaCm) => aggiornaDati({ altezzaCm })}
        />

        {/* Le etichette sono lunghe: menu a tutta larghezza sotto il nome
            del campo, invece che nella riga, per non troncarle. */}
        <div className="riga-impostazioni relative px-4 py-3">
          <label htmlFor="profilo-attivita" className="mb-2 block text-base">
            Livello di attività
          </label>
          <select
            id="profilo-attivita"
            value={dp.ora.livelloAttivita}
            onChange={(e) =>
              aggiornaDati({ livelloAttivita: e.target.value as LivelloAttivita | "" })
            }
            className={`w-full rounded-lg border border-border bg-background p-2 text-base ${CLASSE_FOCUS}`}
          >
            <option value="">Non impostato</option>
            {OPZIONI_ATTIVITA.map((opzione) => (
              <option key={opzione.valore} value={opzione.valore}>
                {opzione.etichetta}
              </option>
            ))}
          </select>
          <ValorePrecedente
            visibile={dp.prima.livelloAttivita !== dp.ora.livelloAttivita}
            valore={etichettaDi(OPZIONI_ATTIVITA, dp.prima.livelloAttivita)}
          />
        </div>
      </GruppoImpostazioni>

      <SalvataggioModulo modulo={modulo} />
    </main>
  );
}
