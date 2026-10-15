// dividiAmicizie: le righe di amicizie divise per la pagina Amici
// (PUNTO_DI_PARTENZA.md §3 "Amici"). Test permanente: una riga nella sezione
// sbagliata mostra pulsanti che il database rifiuta (Annulla su una
// richiesta ricevuta), o fa vedere a chi ha rifiutato una richiesta che non
// deve più vedere. La RLS manda già solo le righe giuste, ma la funzione non
// deve dipendere da lei.

import { describe, expect, it } from "vitest";
import type { Amicizia, StatoAmicizia } from "@/lib/db/tipi";
import { dividiAmicizie, inizialiUsername } from "./amicizie";

const IO = "io";

function riga(
  id: string,
  campi: Partial<Amicizia> & { user_id: string; amico_id: string; stato: StatoAmicizia }
): Amicizia {
  return {
    id,
    risposta_il: null,
    rifiuto_visto: false,
    creato_il: "2026-10-15T10:00:00.000Z",
    updated_at: "2026-10-15T10:00:00.000Z",
    deleted_at: null,
    ...campi,
  };
}

const NOMI = { marco: "marco_b", sara: "sara_c", paolo: "paolo_a", giulia: "giulia_r", luca: "luca_f" };

describe("dividiAmicizie", () => {
  it("mette ogni riga nella sua sezione, con l'altro e il suo username", () => {
    const d = dividiAmicizie(
      [
        riga("r1", { user_id: "marco", amico_id: IO, stato: "in_attesa" }),
        riga("r2", { user_id: IO, amico_id: "giulia", stato: "in_attesa" }),
        riga("r3", { user_id: IO, amico_id: "luca", stato: "rifiutata", risposta_il: "2026-10-15T11:00:00.000Z" }),
        riga("r4", { user_id: "sara", amico_id: IO, stato: "accettata" }),
        riga("r5", { user_id: IO, amico_id: "paolo", stato: "accettata" }),
      ],
      NOMI,
      IO
    );
    expect(d.ricevute.map((v) => [v.id, v.altroId, v.username])).toEqual([["r1", "marco", "marco_b"]]);
    expect(d.inviate.map((v) => [v.id, v.altroId, v.username])).toEqual([["r2", "giulia", "giulia_r"]]);
    expect(d.nonAccettate.map((v) => [v.id, v.username])).toEqual([["r3", "luca_f"]]);
    // Amici da tutti e due i lati, in ordine alfabetico di username.
    expect(d.amici.map((v) => v.username)).toEqual(["paolo_a", "sara_c"]);
  });

  it("una richiesta che ho rifiutato io non arriva: chi rifiuta non vede altro", () => {
    const d = dividiAmicizie(
      [riga("r1", { user_id: "marco", amico_id: IO, stato: "rifiutata", risposta_il: "2026-10-15T11:00:00.000Z" })],
      NOMI,
      IO
    );
    expect(d).toEqual({ ricevute: [], inviate: [], nonAccettate: [], amici: [] });
  });

  it("un rifiuto già chiuso con Ok non compare più", () => {
    const d = dividiAmicizie(
      [riga("r1", { user_id: IO, amico_id: "luca", stato: "rifiutata", rifiuto_visto: true })],
      NOMI,
      IO
    );
    expect(d.nonAccettate).toEqual([]);
  });

  it("scarta le righe cancellate e quelle in cui non ci sono io", () => {
    const d = dividiAmicizie(
      [
        riga("r1", { user_id: IO, amico_id: "sara", stato: "accettata", deleted_at: "2026-10-15T12:00:00.000Z" }),
        riga("r2", { user_id: "marco", amico_id: "sara", stato: "accettata" }),
      ],
      NOMI,
      IO
    );
    expect(d).toEqual({ ricevute: [], inviate: [], nonAccettate: [], amici: [] });
  });

  it("le richieste vanno dalla più recente", () => {
    const d = dividiAmicizie(
      [
        riga("vecchia", { user_id: "marco", amico_id: IO, stato: "in_attesa", creato_il: "2026-10-13T08:00:00.000Z" }),
        riga("nuova", { user_id: "sara", amico_id: IO, stato: "in_attesa", creato_il: "2026-10-15T08:00:00+00:00" }),
        riga("mezzo", { user_id: "paolo", amico_id: IO, stato: "in_attesa", creato_il: "2026-10-14T08:00:00.000000+00:00" }),
      ],
      NOMI,
      IO
    );
    // Formati diversi (client e PostgREST) confrontati come istanti.
    expect(d.ricevute.map((v) => v.id)).toEqual(["nuova", "mezzo", "vecchia"]);
  });

  it("username mancante: la riga resta, con username null, e fra gli amici va in fondo", () => {
    const d = dividiAmicizie(
      [
        riga("r1", { user_id: "sconosciuto", amico_id: IO, stato: "in_attesa" }),
        riga("r2", { user_id: IO, amico_id: "sconosciuto2", stato: "accettata" }),
        riga("r3", { user_id: IO, amico_id: "sara", stato: "accettata" }),
      ],
      NOMI,
      IO
    );
    expect(d.ricevute.map((v) => [v.id, v.username])).toEqual([["r1", null]]);
    expect(d.amici.map((v) => v.username)).toEqual(["sara_c", null]);
  });
});

describe("inizialiUsername", () => {
  it("prime lettere delle prime due parti separate da _", () => {
    expect(inizialiUsername("marco_b")).toBe("mb");
    expect(inizialiUsername("a_b_c")).toBe("ab");
  });

  it("senza _ (o con _ solo ai bordi), le prime due lettere", () => {
    expect(inizialiUsername("luigi2")).toBe("lu");
    expect(inizialiUsername("abc_")).toBe("ab");
  });

  it("senza nome, un punto di domanda", () => {
    expect(inizialiUsername(null)).toBe("?");
  });
});
