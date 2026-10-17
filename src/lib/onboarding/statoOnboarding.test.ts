import { describe, expect, it } from "vitest";
import {
  cosaManca,
  passoDiPartenza,
  primoPassoDaFare,
  segnoDaiMetadati,
  statoSegno,
  type IngressiSegno,
} from "./statoOnboarding";
import type { Misurazione, Obiettivo, Profilo } from "../db/tipi";

// Le decisioni dell'onboarding (PUNTO_DI_PARTENZA.md, sezione 3,
// "Onboarding"). Sbagliano in silenzio: un passo deciso male fa ripartire
// l'onboarding da un passo già salvato (e su un dispositivo vuoto crea un
// profilo doppio), un segno letto male mostra l'onboarding a un utente di
// prima, o lo fa ricomparire a chi l'ha già finito.

const VIVO = { user_id: "u", updated_at: "2026-10-17T08:00:00.000Z", deleted_at: null };
const CANCELLATO = "2026-10-17T09:00:00.000Z";

function profilo(campi: Partial<Profilo> = {}): Profilo {
  return {
    id: "p1",
    ...VIVO,
    nome: null,
    sesso: "non_indicato",
    data_nascita: "1990-01-10",
    altezza_cm: 180,
    livello_attivita: "moderato",
    differenzia_giorni: false,
    giorni_allenamento_default: null,
    ...campi,
  };
}

function misurazione(campi: Partial<Misurazione> = {}): Misurazione {
  return {
    id: "m1",
    ...VIVO,
    tipo: "peso",
    valore: 80,
    unita: "kg",
    data: "2026-10-17",
    ...campi,
  };
}

function obiettivo(campi: Partial<Obiettivo> = {}): Obiettivo {
  return {
    id: "o1",
    ...VIVO,
    valido_dal: "2026-10-17",
    tipo: "mantenere",
    kcal: 2500,
    proteine_g: 180,
    carboidrati_g: 250,
    grassi_g: 80,
    peso_obiettivo: null,
    ...campi,
  };
}

describe("primoPassoDaFare e cosaManca", () => {
  it("niente salvato: passo 2, mancano tutti e quattro", () => {
    expect(primoPassoDaFare(null, [], [])).toBe(2);
    expect(cosaManca(null, [], [])).toEqual([
      "Su di te",
      "Il tuo peso",
      "Il tuo obiettivo",
      "Obiettivi giornalieri",
    ]);
  });

  it("profilo con un campo vuoto, uno per volta: passo 2", () => {
    for (const campi of [{ data_nascita: null }, { data_nascita: "" }, { altezza_cm: null }]) {
      expect(primoPassoDaFare(profilo(campi), [misurazione()], [])).toBe(2);
    }
    // livello_attivita è NOT NULL su Supabase, ma una riga locale rovinata
    // non deve far saltare il passo.
    const senzaLivello = profilo({ livello_attivita: "" as Profilo["livello_attivita"] });
    expect(primoPassoDaFare(senzaLivello, [misurazione()], [])).toBe(2);
  });

  it("il sesso non si controlla: «non indicato» con gli altri tre campi va avanti", () => {
    expect(primoPassoDaFare(profilo({ sesso: "non_indicato" }), [], [])).toBe(3);
  });

  it("profilo cancellato: come assente", () => {
    expect(primoPassoDaFare(profilo({ deleted_at: CANCELLATO }), [misurazione()], [])).toBe(2);
  });

  it("profilo completo, nessuna pesata: passo 3", () => {
    expect(primoPassoDaFare(profilo(), [], [])).toBe(3);
    expect(cosaManca(profilo(), [], [])).toEqual([
      "Il tuo peso",
      "Il tuo obiettivo",
      "Obiettivi giornalieri",
    ]);
  });

  it("contano solo le pesate vive: una cancellata o un'altra misura non bastano", () => {
    expect(primoPassoDaFare(profilo(), [misurazione({ deleted_at: CANCELLATO })], [])).toBe(3);
    expect(primoPassoDaFare(profilo(), [misurazione({ tipo: "vita", unita: "cm" })], [])).toBe(3);
  });

  it("profilo e pesata: passo 4, mai il 5; mancano i due degli obiettivi", () => {
    expect(primoPassoDaFare(profilo(), [misurazione()], [])).toBe(4);
    expect(cosaManca(profilo(), [misurazione()], [])).toEqual([
      "Il tuo obiettivo",
      "Obiettivi giornalieri",
    ]);
  });

  it("pesata senza profilo: passo 2, e fra le cose che mancano non c'è il peso", () => {
    expect(primoPassoDaFare(null, [misurazione()], [])).toBe(2);
    expect(cosaManca(null, [misurazione()], [])).toEqual([
      "Su di te",
      "Il tuo obiettivo",
      "Obiettivi giornalieri",
    ]);
  });

  it("un obiettivo vivo: finito, anche senza profilo e senza pesate", () => {
    expect(primoPassoDaFare(null, [], [obiettivo()])).toBe("finito");
    expect(cosaManca(null, [], [obiettivo()])).toEqual([]);
  });

  it("un obiettivo cancellato non conta", () => {
    expect(primoPassoDaFare(profilo(), [misurazione()], [obiettivo({ deleted_at: CANCELLATO })])).toBe(4);
  });
});

describe("passoDiPartenza", () => {
  it("ripresa senza niente salvato: dal Benvenuto", () => {
    expect(passoDiPartenza("ripresa", null, [], [])).toBe(1);
  });

  it("ripresa con qualcosa salvato: dal primo passo da fare", () => {
    expect(passoDiPartenza("ripresa", profilo(), [], [])).toBe(3);
    expect(passoDiPartenza("ripresa", profilo(), [misurazione()], [])).toBe(4);
    // Anche un profilo incompleto è "qualcosa": si riparte dal 2, non dal
    // Benvenuto.
    expect(passoDiPartenza("ripresa", profilo({ altezza_cm: null }), [], [])).toBe(2);
    // Una pesata senza profilo, idem.
    expect(passoDiPartenza("ripresa", null, [misurazione()], [])).toBe(2);
  });

  it("righe cancellate non sono «qualcosa di salvato»", () => {
    expect(
      passoDiPartenza(
        "ripresa",
        profilo({ deleted_at: CANCELLATO }),
        [misurazione({ deleted_at: CANCELLATO })],
        [obiettivo({ deleted_at: CANCELLATO })]
      )
    ).toBe(1);
  });

  it("continua: mai dal Benvenuto, anche senza niente salvato", () => {
    expect(passoDiPartenza("continua", null, [], [])).toBe(2);
    expect(passoDiPartenza("continua", profilo(), [misurazione()], [])).toBe(4);
  });

  it("con un obiettivo: finito, in tutti e due i casi", () => {
    expect(passoDiPartenza("ripresa", null, [], [obiettivo()])).toBe("finito");
    expect(passoDiPartenza("continua", null, [], [obiettivo()])).toBe("finito");
  });
});

describe("segnoDaiMetadati", () => {
  it("i tre valori validi", () => {
    expect(segnoDaiMetadati({ onboarding: "da_fare" })).toBe("da_fare");
    expect(segnoDaiMetadati({ onboarding: "rimandato" })).toBe("rimandato");
    expect(segnoDaiMetadati({ onboarding: "fatto" })).toBe("fatto");
  });

  it("assente, metadati mancanti o valore sconosciuto: assente", () => {
    expect(segnoDaiMetadati(undefined)).toBe(null);
    expect(segnoDaiMetadati({ nome: "Giulia", username: "giulia" })).toBe(null);
    expect(segnoDaiMetadati({ onboarding: "DA_FARE" })).toBe(null);
    expect(segnoDaiMetadati({ onboarding: true })).toBe(null);
    expect(segnoDaiMetadati({ onboarding: null })).toBe(null);
  });
});

describe("statoSegno", () => {
  // Il caso di partenza: dati noti, nessun obiettivo, niente in sospeso.
  const base: IngressiSegno = {
    metadati: null,
    locale: null,
    ciSonoObiettivi: false,
    discesaRiuscita: true,
    righeInDexie: true,
  };
  const niente = { mostraOnboarding: false, mostraScheda: false, attendiDiscesa: false };

  it("utente senza segno: mai onboarding, mai scheda, anche senza obiettivi", () => {
    expect(statoSegno(base)).toEqual({ segno: null, ...niente });
    expect(statoSegno({ ...base, discesaRiuscita: false, righeInDexie: false })).toEqual({
      segno: null,
      ...niente,
    });
  });

  it("da_fare: onboarding, niente scheda", () => {
    expect(statoSegno({ ...base, metadati: "da_fare" })).toEqual({
      segno: "da_fare",
      mostraOnboarding: true,
      mostraScheda: false,
      attendiDiscesa: false,
    });
  });

  it("da_fare con un obiettivo: fatto", () => {
    expect(statoSegno({ ...base, metadati: "da_fare", ciSonoObiettivi: true })).toEqual({
      segno: "fatto",
      ...niente,
    });
  });

  it("rimandato con 0 obiettivi: la scheda; con un obiettivo: fatto", () => {
    expect(statoSegno({ ...base, metadati: "rimandato" })).toEqual({
      segno: "rimandato",
      mostraOnboarding: false,
      mostraScheda: true,
      attendiDiscesa: false,
    });
    expect(statoSegno({ ...base, metadati: "rimandato", ciSonoObiettivi: true })).toEqual({
      segno: "fatto",
      ...niente,
    });
  });

  it("fatto: niente", () => {
    expect(statoSegno({ ...base, metadati: "fatto" })).toEqual({ segno: "fatto", ...niente });
  });

  it("la chiave locale vince sui metadati", () => {
    // Finito offline: il server dice ancora da_fare.
    expect(statoSegno({ ...base, metadati: "da_fare", locale: "fatto" })).toEqual({
      segno: "fatto",
      ...niente,
    });
    // "Dopo" offline: il server dice ancora da_fare, ma l'onboarding non
    // deve riaprirsi.
    expect(statoSegno({ ...base, metadati: "da_fare", locale: "rimandato" })).toEqual({
      segno: "rimandato",
      mostraOnboarding: false,
      mostraScheda: true,
      attendiDiscesa: false,
    });
    // Continua e finito offline dopo un "Dopo" già confermato.
    expect(statoSegno({ ...base, metadati: "rimandato", locale: "fatto" })).toEqual({
      segno: "fatto",
      ...niente,
    });
  });

  it("dati non noti (nessuna discesa riuscita, Dexie vuoto): si aspetta", () => {
    const vuoto = { ...base, discesaRiuscita: false, righeInDexie: false };
    // da_fare: la guardia porta all'onboarding, ma il passo non si decide.
    expect(statoSegno({ ...vuoto, metadati: "da_fare" })).toEqual({
      segno: "da_fare",
      mostraOnboarding: true,
      mostraScheda: false,
      attendiDiscesa: true,
    });
    // rimandato: niente scheda finché non si sa se gli obiettivi ci sono
    // (nessun lampo per chi li ha impostati su un altro dispositivo).
    expect(statoSegno({ ...vuoto, metadati: "rimandato" })).toEqual({
      segno: "rimandato",
      mostraOnboarding: false,
      mostraScheda: false,
      attendiDiscesa: true,
    });
  });

  it("basta una delle due: discesa riuscita oppure righe in Dexie", () => {
    for (const noti of [
      { discesaRiuscita: true, righeInDexie: false },
      { discesaRiuscita: false, righeInDexie: true },
    ]) {
      const stato = statoSegno({ ...base, ...noti, metadati: "rimandato" });
      expect(stato.mostraScheda).toBe(true);
      expect(stato.attendiDiscesa).toBe(false);
    }
  });
});
