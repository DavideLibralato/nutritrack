// La macchina degli stati del cambio foto (statoCambioFoto.ts). Errori che
// non fanno rumore: un Riprova che ricarica una foto diversa da quella
// ritagliata, un foglio che si chiude a metà caricamento, una risposta in
// ritardo che riporta indietro lo stato. Casi fissati:
// - il percorso completo, fino a "fatto";
// - Riprova ricarica la STESSA foto pronta;
// - errori della foto: "non si apre" o "non preparata", senza Riprova;
// - durante un lavoro niente si apre né si chiude;
// - un evento fuori fase non cambia lo stato;
// - Elimina foto, anche fallita e ripetuta;
// - il tocco: offline, con e senza foto, durante un lavoro.

import { describe, it, expect } from "vitest";
import {
  azioneTocco,
  occupato,
  prossimoStatoFoto,
  RIPOSO,
  type EventoFoto,
  type StatoFoto,
} from "./statoCambioFoto";
import { TESTO_ELIMINA_FALLITA, TESTO_NON_PREPARATA, TESTO_NON_SI_APRE } from "./testiFoto";

const scelta = new Blob(["originale"], { type: "image/heic" });
const pronta = new Blob(["jpeg"], { type: "image/jpeg" });

function dopo(stato: StatoFoto, ...eventi: EventoFoto[]): StatoFoto {
  return eventi.reduce(prossimoStatoFoto, stato);
}

const fino_al_caricamento: EventoFoto[] = [
  { tipo: "file-scelto", file: scelta },
  { tipo: "usa-foto" },
  { tipo: "preparata", esito: { esito: "ok", file: pronta } },
];

describe("prossimoStatoFoto: cambiare la foto", () => {
  it("scelta, ritaglio, preparazione, caricamento, fatto, e il messaggio si chiude", () => {
    let s = dopo(RIPOSO, { tipo: "file-scelto", file: scelta });
    expect(s).toEqual({ fase: "ritaglio", file: scelta });
    s = dopo(s, { tipo: "usa-foto" });
    expect(s).toEqual({ fase: "preparazione", file: scelta });
    s = dopo(s, { tipo: "preparata", esito: { esito: "ok", file: pronta } });
    expect(s).toEqual({ fase: "caricamento", foto: pronta });
    s = dopo(s, {
      tipo: "caricata",
      esito: { esito: "ok", percorso: "u/x.jpg", avanziRimasti: false },
    });
    expect(s).toEqual({ fase: "fatto", cosa: "aggiornata" });
    expect(dopo(s, { tipo: "chiudi-messaggio" })).toEqual(RIPOSO);
  });

  it("con la foto si passa dal foglio Foto profilo; Modifica (annulla + file) porta al ritaglio", () => {
    const s = dopo(
      RIPOSO,
      { tipo: "apri-scelta" },
      { tipo: "annulla" },
      { tipo: "file-scelto", file: scelta }
    );
    expect(s).toEqual({ fase: "ritaglio", file: scelta });
  });

  it("avanzi rimasti sul server: per l'utente è fatto lo stesso", () => {
    const s = dopo(RIPOSO, ...fino_al_caricamento, {
      tipo: "caricata",
      esito: { esito: "ok", percorso: "u/x.jpg", avanziRimasti: true },
    });
    expect(s).toEqual({ fase: "fatto", cosa: "aggiornata" });
  });

  it("caricamento fallito → Riprova ricarica la stessa foto pronta, senza rifare ritaglio e preparazione", () => {
    for (const esito of [
      { esito: "caricamento-fallito" },
      { esito: "impostazione-fallita" },
    ] as const) {
      const fallito = dopo(RIPOSO, ...fino_al_caricamento, { tipo: "caricata", esito });
      expect(fallito).toEqual({ fase: "caricamento-fallito", foto: pronta });
      const ripreso = dopo(fallito, { tipo: "riprova" });
      expect(ripreso.fase).toBe("caricamento");
      expect(ripreso.fase === "caricamento" && ripreso.foto).toBe(pronta);
    }
  });

  it("foto che non si apre o non si prepara: errore senza Riprova, si riparte dal tocco", () => {
    const nonSiApre = dopo(
      RIPOSO,
      { tipo: "file-scelto", file: scelta },
      { tipo: "usa-foto" },
      {
        tipo: "preparata",
        esito: { esito: "non-si-apre" },
      }
    );
    expect(nonSiApre).toEqual({ fase: "foto-non-valida", testo: TESTO_NON_SI_APRE });
    expect(dopo(nonSiApre, { tipo: "riprova" })).toBe(nonSiApre);

    for (const esito of [
      { esito: "ritaglio-non-valido" },
      { esito: "canvas-non-disponibile" },
      { esito: "non-jpeg", tipo: "image/png" },
      { esito: "troppo-grande", byte: 600_000 },
    ] as const) {
      const s = dopo(
        RIPOSO,
        { tipo: "file-scelto", file: scelta },
        { tipo: "usa-foto" },
        { tipo: "preparata", esito }
      );
      expect(s).toEqual({ fase: "foto-non-valida", testo: TESTO_NON_PREPARATA });
    }

    // Un tocco nuovo riparte: il menu dell'iPhone e poi il ritaglio.
    expect(dopo(nonSiApre, { tipo: "file-scelto", file: scelta }).fase).toBe("ritaglio");
  });

  it("Annulla dal ritaglio torna a riposo; durante la preparazione no", () => {
    expect(dopo(RIPOSO, { tipo: "file-scelto", file: scelta }, { tipo: "annulla" })).toEqual(
      RIPOSO
    );
    const preparazione = dopo(RIPOSO, { tipo: "file-scelto", file: scelta }, { tipo: "usa-foto" });
    expect(dopo(preparazione, { tipo: "annulla" })).toBe(preparazione);
  });

  it("durante il caricamento niente si apre: né scelta, né menu, né riquadro offline", () => {
    const caricamento = dopo(RIPOSO, ...fino_al_caricamento);
    for (const evento of [
      { tipo: "apri-scelta" },
      { tipo: "file-scelto", file: scelta },
      { tipo: "senza-rete" },
      { tipo: "annulla" },
      { tipo: "riprova" },
      { tipo: "chiedi-elimina" },
    ] as const) {
      expect(dopo(caricamento, evento)).toBe(caricamento);
    }
  });

  it("un evento fuori fase non cambia lo stato", () => {
    const fatto = dopo(RIPOSO, ...fino_al_caricamento, {
      tipo: "caricata",
      esito: { esito: "ok", percorso: "u/x.jpg", avanziRimasti: false },
    });
    // Una risposta di caricamento arrivata dopo: niente "fallito" sopra "fatto".
    expect(dopo(fatto, { tipo: "caricata", esito: { esito: "caricamento-fallito" } })).toBe(fatto);
    expect(dopo(RIPOSO, { tipo: "preparata", esito: { esito: "ok", file: pronta } })).toBe(RIPOSO);
    expect(dopo(RIPOSO, { tipo: "usa-foto" })).toBe(RIPOSO);
    expect(dopo(RIPOSO, { tipo: "eliminata", esito: { esito: "ok", avanziRimasti: false } })).toBe(
      RIPOSO
    );
    expect(dopo(RIPOSO, { tipo: "chiudi-messaggio" })).toBe(RIPOSO);
  });
});

describe("prossimoStatoFoto: eliminare la foto", () => {
  const conferma = dopo(RIPOSO, { tipo: "apri-scelta" }, { tipo: "chiedi-elimina" });

  it("scelta → conferma → eliminazione → fatto", () => {
    expect(conferma).toEqual({ fase: "conferma-elimina", errore: null });
    const s = dopo(conferma, { tipo: "conferma-elimina" });
    expect(s).toEqual({ fase: "eliminazione" });
    expect(dopo(s, { tipo: "eliminata", esito: { esito: "ok", avanziRimasti: true } })).toEqual({
      fase: "fatto",
      cosa: "eliminata",
    });
  });

  it("fallita → resta la conferma con l'errore, e si può ripetere", () => {
    const fallita = dopo(
      conferma,
      { tipo: "conferma-elimina" },
      { tipo: "eliminata", esito: { esito: "fallito" } }
    );
    expect(fallita).toEqual({ fase: "conferma-elimina", errore: TESTO_ELIMINA_FALLITA });
    expect(dopo(fallita, { tipo: "conferma-elimina" })).toEqual({ fase: "eliminazione" });
    expect(dopo(fallita, { tipo: "annulla" })).toEqual(RIPOSO);
  });

  it("durante l'eliminazione il foglio non si chiude", () => {
    const s = dopo(conferma, { tipo: "conferma-elimina" });
    expect(occupato(s)).toBe(true);
    expect(dopo(s, { tipo: "annulla" })).toBe(s);
  });

  it("Elimina si chiede solo dal foglio Foto profilo", () => {
    expect(dopo(RIPOSO, { tipo: "chiedi-elimina" })).toBe(RIPOSO);
  });
});

describe("azioneTocco", () => {
  it("offline → riquadro, con o senza foto", () => {
    expect(azioneTocco(RIPOSO, false, true)).toBe("senza-rete");
    expect(azioneTocco(RIPOSO, false, false)).toBe("senza-rete");
  });

  it("online: con la foto il foglio di scelta, senza il menu dell'iPhone", () => {
    expect(azioneTocco(RIPOSO, true, true)).toBe("scelta");
    expect(azioneTocco(RIPOSO, true, false)).toBe("selettore");
  });

  it("dopo un errore il tocco riparte; durante un lavoro non fa niente", () => {
    const fallito: StatoFoto = { fase: "caricamento-fallito", foto: pronta };
    expect(azioneTocco(fallito, true, true)).toBe("scelta");
    for (const s of [
      { fase: "preparazione", file: scelta },
      { fase: "caricamento", foto: pronta },
      { fase: "eliminazione" },
    ] as StatoFoto[]) {
      expect(azioneTocco(s, true, true)).toBe("niente");
      expect(azioneTocco(s, false, false)).toBe("niente");
    }
  });
});
