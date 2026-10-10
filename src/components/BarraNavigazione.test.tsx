import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import BarraNavigazione from "./BarraNavigazione";
import GuardianoModifiche from "./GuardianoModifiche";
import { db } from "@/lib/db/database";
import type { VoceOutbox } from "@/lib/sync/outbox";
import { azzeraStatoGiri, segnaFineGiro } from "@/lib/sync/statoSincronizzazione";

// Il pallino sulla tab Impostazioni (decisione del 10/10): acceso solo per
// accantonate, accesso scaduto e server che rifiuta dal secondo giro
// fallito di fila; spento senza rete. Un pallino che si accende per un
// intoppo di rete diventa rumore e si smette di guardarlo; uno che non si
// accende per un errore vero è il "Salvato." del 6/9 di nuovo. Le priorità
// hanno i loro test in statoSincronizzazione.test.ts: qui la barra vera.

const USER_ID = "utente-test-pallino";

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => USER_ID,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));

function voce(id: string, altro: Partial<VoceOutbox> = {}): VoceOutbox {
  return {
    id: `misurazioni:${id}`,
    tabella: "misurazioni",
    record_id: id,
    dati: { id, user_id: USER_ID, updated_at: "2026-10-10T12:00:00.000Z", deleted_at: null },
    creato_il: "2026-10-10T12:00:00.000Z",
    tentativi: 0,
    ultimo_errore: null,
    sospesa_il: null,
    ...altro,
  };
}

beforeEach(async () => {
  window.localStorage.clear();
  azzeraStatoGiri();
  await db.outbox.clear();
});

afterEach(cleanup);

function disegna() {
  render(
    <GuardianoModifiche>
      <BarraNavigazione />
    </GuardianoModifiche>
  );
}

function voceImpostazioni() {
  return screen.getByRole("link", { name: /^Impostazioni/ });
}

async function pallinoAcceso() {
  await waitFor(() => expect(voceImpostazioni().querySelector("[data-pallino-sincronizzazione]")).not.toBeNull());
  expect(voceImpostazioni().textContent).toContain("sincronizzazione da controllare");
}

// Spento: si aspetta che la coda sia arrivata da Dexie (un giro di
// rendering in più), poi si controlla che il pallino non ci sia.
async function pallinoSpento() {
  await new Promise((r) => setTimeout(r, 100));
  expect(voceImpostazioni().querySelector("[data-pallino-sincronizzazione]")).toBeNull();
  expect(voceImpostazioni().textContent).not.toContain("da controllare");
}

describe("pallino sulla tab Impostazioni", () => {
  it("acceso con modifiche accantonate", async () => {
    await db.outbox.put(voce("m1", { tentativi: 5, sospesa_il: "2026-10-10T12:05:00.000Z" }));
    disegna();
    await pallinoAcceso();
  });

  it("acceso con l'accesso scaduto", async () => {
    segnaFineGiro("salita", "sessione", { parlatoColServer: false });
    disegna();
    await pallinoAcceso();
  });

  it("server che rifiuta: spento al primo giro fallito, acceso dal secondo", async () => {
    await db.outbox.put(voce("m1"));
    segnaFineGiro("salita", "errore", { parlatoColServer: false });
    disegna();
    await pallinoSpento();
    cleanup();

    segnaFineGiro("salita", "errore", { parlatoColServer: false });
    disegna();
    await pallinoAcceso();
  });

  it("spento senza rete, anche con modifiche in attesa da molti giri", async () => {
    await db.outbox.put(voce("m1"));
    for (let i = 0; i < 5; i++) segnaFineGiro("salita", "rete", { parlatoColServer: false });
    disegna();
    await pallinoSpento();
  });

  it("si spegne da solo quando un giro finisce bene", async () => {
    segnaFineGiro("salita", "sessione", { parlatoColServer: false });
    disegna();
    await pallinoAcceso();

    segnaFineGiro("salita", "ok", { parlatoColServer: true });
    await waitFor(() => expect(voceImpostazioni().querySelector("[data-pallino-sincronizzazione]")).toBeNull());
  });
});
