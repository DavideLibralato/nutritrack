"use client";

// Impostazioni > Obiettivi (PUNTO_DI_PARTENZA.md, sezione 3, "Impostazioni",
// decisioni A, B, C; mockup in docs/mockups/impostazioni.html). Dall'alto:
//   1. Obiettivo: Dimagrire / Mantenere / Massa, peso obiettivo, "Calcola
//      proposta";
//   2. Giorni di allenamento: l'interruttore e, se acceso, i sette giorni
//      con la frase della decisione C. Sta SOPRA i target: accendendolo il
//      contenuto compare sotto, non fuori dallo schermo;
//   3. i target, con i campi nella riga. Con l'interruttore acceso, sopra c'è
//      il selettore Normale | Allenamento (un pallino sulla scheda con
//      modifiche non salvate); spento, solo i target normali.
//
// Un solo Salva per tutta la pagina, anche cambiando scheda: stato, bivio
// "cambio vero o correzione?" ed esiti stanno in useModuloImpostazioni, la
// logica di scrittura in salvataggioProfilo.ts (salvaProfilo, invariato).
// La pagina modifica solo obiettivo, target e giorni; i dati personali li
// carica per il calcolo della proposta, ma si cambiano in Profilo.

import { useState, type ReactNode } from "react";
import { useModuloImpostazioni } from "@/lib/profilo/useModuloImpostazioni";
import { calcolaEta, calcolaFabbisogno } from "@/lib/fabbisogno";
import { formattaDataBreve } from "@/lib/dataGiorno";
import {
  numeriUguali,
  giorniUguali,
  numeroDaCampo,
  type ValoriModulo,
  type ValoriTarget,
} from "@/lib/profilo/salvataggioProfilo";
import type { GiornoSettimana, TipoObiettivo } from "@/lib/db/tipi";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import RigaCampo from "@/components/RigaCampo";
import Interruttore from "@/components/Interruttore";
import SelettoreSegmenti from "@/components/SelettoreSegmenti";
import CerchiGiorni, { elencoGiorni } from "@/components/CerchiGiorni";
import ValorePrecedente from "@/components/ValorePrecedente";
import LinkProtetto from "@/components/LinkProtetto";
import SalvataggioModulo from "@/components/SalvataggioModulo";

type Scheda = "normale" | "allenamento";

const OPZIONI_OBIETTIVO: { valore: TipoObiettivo; etichetta: string }[] = [
  { valore: "dimagrire", etichetta: "Dimagrire" },
  { valore: "mantenere", etichetta: "Mantenere" },
  { valore: "massa", etichetta: "Massa" },
];

// Le righe dei target, nell'ordine delle etichette dei prodotti: Calorie,
// Grassi, Carboidrati, Proteine (PUNTO_DI_PARTENZA.md §7, "Le barre macro").
const CAMPI_TARGET: { chiave: keyof ValoriTarget; etichetta: string; unita: string }[] = [
  { chiave: "kcal", etichetta: "Calorie", unita: "kcal" },
  { chiave: "grassi", etichetta: "Grassi", unita: "g" },
  { chiave: "carboidrati", etichetta: "Carboidrati", unita: "g" },
  { chiave: "proteine", etichetta: "Proteine", unita: "g" },
];

const CLASSE_MAIN =
  "mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+var(--spazio-fra-barre))]";

function targetCambiati(a: ValoriTarget, b: ValoriTarget): boolean {
  return CAMPI_TARGET.some((c) => !numeriUguali(a[c.chiave], b[c.chiave]));
}

// Rimandi alle pagine dove si completa ciò che manca: Profilo per i dati
// personali, Peso per la pesata. Sono LinkProtetto: con modifiche non
// salvate qui, chiedono prima "Esci senza salvare?".
function LinkSottopagina({ href, testo }: { href: string; testo: string }) {
  return (
    <LinkProtetto
      href={href}
      className={`font-medium text-accent underline underline-offset-2 rounded ${CLASSE_FOCUS}`}
    >
      {testo}
    </LinkProtetto>
  );
}

function LinkProfilo() {
  return <LinkSottopagina href="/impostazioni/profilo" testo="Vai a Profilo" />;
}

function LinkPeso() {
  return <LinkSottopagina href="/impostazioni/peso" testo="Vai a Peso" />;
}

export default function ObiettiviPage() {
  const modulo = useModuloImpostazioni();
  const [scheda, setScheda] = useState<Scheda>("normale");
  const [erroreCalcolo, setErroreCalcolo] = useState<ReactNode>(null);

  if (!modulo.pronto || !modulo.prima || !modulo.ora || !modulo.m) {
    return (
      <main className={CLASSE_MAIN}>
        <IntestazioneSottopagina titolo="Obiettivi" />
        <p className="text-sm text-muted">Caricamento...</p>
      </main>
    );
  }

  const { prima, ora, m, errori, periodo, ultimaPesata } = modulo;
  const ob = { prima: prima.obiettivo, ora: ora.obiettivo };
  const gi = { prima: prima.giorni, ora: ora.giorni };
  const differenzia = gi.ora.differenzia;
  // Spento l'interruttore, si vedono solo i target normali.
  const schedaMostrata: Scheda = differenzia ? scheda : "normale";

  function aggiornaObiettivo(campi: Partial<ValoriModulo["obiettivo"]>) {
    modulo.aggiorna({ ...ora, obiettivo: { ...ora.obiettivo, ...campi } });
  }
  function aggiornaGiorni(campi: Partial<ValoriModulo["giorni"]>) {
    modulo.aggiorna({ ...ora, giorni: { ...ora.giorni, ...campi } });
  }

  function alternaGiorno(giorno: GiornoSettimana) {
    const attivi = ora.giorni.giorniAllenamento;
    aggiornaGiorni({
      giorniAllenamento: attivi.includes(giorno)
        ? attivi.filter((g) => g !== giorno)
        : [...attivi, giorno],
    });
  }

  // Riempie i target normali con una proposta calcolata: non salva niente
  // ("sempre e solo una proposta", sezione 3). Usa i dati personali salvati
  // (si cambiano in Profilo) e l'ultima pesata registrata (in Peso).
  function calcolaProposta() {
    setErroreCalcolo(null);
    const dati = ora.datiPersonali;

    if (!ultimaPesata) return; // il pulsante è già disattivato
    if (dati.sesso === "non_indicato") {
      setErroreCalcolo(
        <>
          Il calcolo automatico richiede il sesso, che si indica in Profilo. Altrimenti scrivi i
          target a mano. <LinkProfilo />
        </>
      );
      return;
    }
    const altezza = numeroDaCampo(dati.altezzaCm);
    if (!dati.dataNascita || Number.isNaN(altezza) || altezza <= 0 || !dati.livelloAttivita) {
      setErroreCalcolo(
        <>
          Per calcolare una proposta servono data di nascita, altezza e livello di attività, in
          Profilo. <LinkProfilo />
        </>
      );
      return;
    }

    const proposta = calcolaFabbisogno({
      sesso: dati.sesso,
      eta: calcolaEta(dati.dataNascita),
      altezzaCm: altezza,
      pesoKg: ultimaPesata.valore,
      livelloAttivita: dati.livelloAttivita,
      tipoObiettivo: ora.obiettivo.tipo,
    });

    aggiornaObiettivo({
      target: {
        kcal: String(proposta.kcal),
        grassi: String(proposta.grassi),
        carboidrati: String(proposta.carboidrati),
        proteine: String(proposta.proteine),
      },
    });
    // La proposta riguarda il giorno normale: si mostra quella scheda.
    setScheda("normale");
  }

  const tipoOPesoCambiati =
    ob.prima.tipo !== ob.ora.tipo || !numeriUguali(ob.prima.pesoObiettivo, ob.ora.pesoObiettivo);
  const normaleCambiato = targetCambiati(ob.prima.target, ob.ora.target);
  const allenamentoCambiato = m.targetAllenamento;

  // L'errore della sezione Obiettivo riguarda il peso obiettivo o i target
  // normali: va sotto il gruppo del campo sbagliato.
  const pesoNonValido = (() => {
    const peso = ob.ora.pesoObiettivo;
    const n = numeroDaCampo(peso);
    return peso.trim() !== "" && (Number.isNaN(n) || n <= 0);
  })();
  const errorePeso = errori.obiettivo && pesoNonValido ? errori.obiettivo : null;
  const erroreTarget = errori.obiettivo && !pesoNonValido ? errori.obiettivo : null;

  const targetMostrati = schedaMostrata === "normale" ? ob : {
    prima: { ...ob.prima, target: gi.prima.targetAllenamento },
    ora: { ...ob.ora, target: gi.ora.targetAllenamento },
  };

  function cambiaTarget(chiave: keyof ValoriTarget, valore: string) {
    if (schedaMostrata === "normale") {
      aggiornaObiettivo({ target: { ...ob.ora.target, [chiave]: valore } });
    } else {
      aggiornaGiorni({ targetAllenamento: { ...gi.ora.targetAllenamento, [chiave]: valore } });
    }
  }

  return (
    <main className={CLASSE_MAIN}>
      <IntestazioneSottopagina titolo="Obiettivi" />

      {/* 1. Obiettivo */}
      <GruppoImpostazioni
        titolo="Obiettivo"
        modificato={tipoOPesoCambiati}
        errore={
          errorePeso || erroreCalcolo ? (
            <>
              {errorePeso && <p>{errorePeso}</p>}
              {erroreCalcolo && <p>{erroreCalcolo}</p>}
            </>
          ) : null
        }
        nota={
          !ultimaPesata ? (
            <>
              Per la proposta serve una pesata: registrala in Peso. <LinkPeso />
            </>
          ) : null
        }
      >
        <div className="riga-impostazioni relative px-3 py-3">
          <SelettoreSegmenti
            etichetta="Obiettivo"
            segmenti={OPZIONI_OBIETTIVO}
            valore={ob.ora.tipo}
            onCambia={(tipo) => aggiornaObiettivo({ tipo })}
          />
          <ValorePrecedente
            visibile={ob.prima.tipo !== ob.ora.tipo}
            valore={OPZIONI_OBIETTIVO.find((o) => o.valore === ob.prima.tipo)?.etichetta ?? ""}
          />
        </div>
        <RigaCampo
          id="obiettivi-peso-obiettivo"
          etichetta="Peso obiettivo"
          unita="kg"
          decimali
          valore={ob.ora.pesoObiettivo}
          precedente={ob.prima.pesoObiettivo}
          cambiato={!numeriUguali(ob.prima.pesoObiettivo, ob.ora.pesoObiettivo)}
          onChange={(pesoObiettivo) => aggiornaObiettivo({ pesoObiettivo })}
        />
        <button
          type="button"
          onClick={calcolaProposta}
          disabled={!ultimaPesata}
          className={`riga-impostazioni relative flex min-h-[52px] w-full items-center justify-center px-4 text-base font-medium text-accent disabled:text-muted ${CLASSE_FOCUS}`}
        >
          Calcola proposta
        </button>
      </GruppoImpostazioni>

      {/* 2. Giorni di allenamento (decisione A) */}
      <GruppoImpostazioni
        titolo="Giorni di allenamento"
        modificato={m.giorniProfilo}
        errore={
          errori.datiPersonali ? (
            <>
              {errori.datiPersonali} <LinkProfilo />
            </>
          ) : null
        }
        nota={
          differenzia
            ? "Da oggi i giorni segnati partono come Allenamento. Quelli già registrati non cambiano."
            : "Da spento, l'app usa gli stessi obiettivi tutti i giorni."
        }
      >
        <Interruttore
          etichetta="Obiettivi diversi nei giorni di allenamento"
          acceso={differenzia}
          onCambia={(acceso) => aggiornaGiorni({ differenzia: acceso })}
        />
        {differenzia && (
          <div className="riga-impostazioni relative pb-1">
            <CerchiGiorni scelti={gi.ora.giorniAllenamento} onAlterna={alternaGiorno} />
            <div className="px-4 pb-2 text-center">
              <ValorePrecedente
                visibile={!giorniUguali(gi.prima.giorniAllenamento, gi.ora.giorniAllenamento)}
                valore={elencoGiorni(gi.prima.giorniAllenamento)}
              />
            </div>
          </div>
        )}
      </GruppoImpostazioni>

      {/* 3. Target: con l'interruttore acceso, il selettore Normale | Allenamento */}
      <div className="flex w-full flex-col gap-[22px]">
        {differenzia && (
          <SelettoreSegmenti
            etichetta="Tipo di giorno"
            segmenti={[
              { valore: "normale", etichetta: "Normale", pallino: normaleCambiato },
              { valore: "allenamento", etichetta: "Allenamento", pallino: allenamentoCambiato },
            ]}
            valore={schedaMostrata}
            onCambia={setScheda}
          />
        )}
        <GruppoImpostazioni
          titolo={
            !differenzia
              ? "Target giornalieri"
              : schedaMostrata === "normale"
                ? "Giorno normale"
                : "Giorno di allenamento"
          }
          modificato={schedaMostrata === "normale" ? normaleCambiato : allenamentoCambiato}
          errore={
            erroreTarget || errori.giorni ? (
              <>
                {erroreTarget && <p>{erroreTarget}</p>}
                {errori.giorni && <p>{errori.giorni}</p>}
              </>
            ) : null
          }
          nota={
            periodo
              ? `In vigore dal ${formattaDataBreve(periodo.valido_dal)}. Al Salva ti chiederemo se è un cambio di dieta o una correzione.`
              : "Il primo obiettivo vale per tutti i giorni, finché non lo cambi."
          }
        >
          {CAMPI_TARGET.map((campo) => (
            <RigaCampo
              key={`${schedaMostrata}-${campo.chiave}`}
              id={`obiettivi-${schedaMostrata}-${campo.chiave}`}
              etichetta={campo.etichetta}
              unita={campo.unita}
              valore={targetMostrati.ora.target[campo.chiave]}
              precedente={targetMostrati.prima.target[campo.chiave]}
              cambiato={
                !numeriUguali(
                  targetMostrati.prima.target[campo.chiave],
                  targetMostrati.ora.target[campo.chiave]
                )
              }
              onChange={(valore) => cambiaTarget(campo.chiave, valore)}
            />
          ))}
        </GruppoImpostazioni>
      </div>

      <SalvataggioModulo modulo={modulo} />
    </main>
  );
}
