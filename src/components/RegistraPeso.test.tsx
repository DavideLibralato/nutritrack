// "Registra peso" scrive la pesata arrotondata a un decimale, con la stessa
// regola di ogni numero scritto (arrotondaDecimali): "78,46" → 78,5 in
// Dexie, e lo stesso numero nel messaggio. Un peso che arrotondato fa 0
// non si registra.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RegistraPeso from "./RegistraPeso";
import { db } from "@/lib/db/database";

// Il repository prova subito a inviare l'outbox: qui la rete "non c'è".
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => {
      throw new Error("Rete non disponibile (finta, nei test).");
    },
    auth: { getSession: async () => ({ data: { session: null } }) },
  }),
}));

const USER = "utente-registra-peso";

beforeEach(async () => {
  await Promise.all([db.misurazioni.clear(), db.outbox.clear()]);
});
afterEach(cleanup);

async function registra(valore: string) {
  const { container } = render(<RegistraPeso userId={USER} />);
  const campo = container.querySelector("#profilo-registra-peso") as HTMLInputElement;
  fireEvent.change(campo, { target: { value: valore } });
  fireEvent.submit(screen.getByRole("form", { name: "Registra peso" }));
}

describe("RegistraPeso", () => {
  it("«78,46» → 78,5 in Dexie e nel messaggio", async () => {
    await registra("78,46");
    expect(await screen.findByText("Registrato: 78,5 kg oggi.")).toBeTruthy();
    const [pesata] = await db.misurazioni.toArray();
    expect(pesata.valore).toBe(78.5);
  });

  it("«0,04» arrotondato fa 0: non si registra", async () => {
    await registra("0,04");
    expect(await screen.findByText("Scrivi il peso in kg, per esempio 78,4.")).toBeTruthy();
    expect(await db.misurazioni.count()).toBe(0);
  });
});
