// Il foglio dei doppioni oltre il massimo di 99999,99 g (numeric(7,2);
// caso 5 dei "doppioni rimasti", 18/10). Somma già scelta è comoda (un
// tocco per confermare), ma con un totale oltre il massimo il server
// rifiuterebbe la riga: lì Somma è spenta, il blocco parte da "Tieni
// separati" e un testo dice perché. Al limite esatto tutto resta come
// sempre. La rete nei piani (grammiRigaCheResta) è in vociDiario.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import SheetDoppioni from "./SheetDoppioni";
import type { Doppione } from "@/lib/diario/pianoSpostamento";

afterEach(cleanup);

const TESTO_OLTRE = "La somma supera 99999,99 g: scegli un'altra opzione.";

function doppione(nome: string, grammiEsistenti: number, grammiInArrivo: number): Doppione {
  return { alimentoId: `alimento-${nome}`, nome, grammiEsistenti, grammiInArrivo, righeEsistenti: 1, righeInArrivo: 1 };
}

function apri(doppioni: Doppione[], onConferma = vi.fn()) {
  render(
    <SheetDoppioni
      titolo="Doppioni"
      doppioni={doppioni}
      nomeDestinazione="Pranzo"
      nomePartenza="Cena"
      etichettaEscludi="Non spostarlo"
      esitoEscludi="Resta in Cena, non si sposta"
      etichettaConferma="Sposta"
      onAnnulla={() => {}}
      onConferma={onConferma}
    />
  );
  return onConferma;
}

function blocco(nome: string) {
  return within(screen.getByRole("group", { name: nome }));
}

describe("SheetDoppioni — Somma oltre il massimo", () => {
  it("oltre 99999,99 g: Somma spenta, parte da Tieni separati, il testo spiega", () => {
    const onConferma = apri([doppione("Mela", 50000, 50000)]);
    const mela = blocco("Mela");

    const somma = mela.getByRole("radio", { name: /^Somma/ });
    expect((somma as HTMLButtonElement).disabled).toBe(true);
    expect(somma.getAttribute("aria-checked")).toBe("false");
    expect(mela.getByRole("radio", { name: "Tieni separati" }).getAttribute("aria-checked")).toBe("true");
    expect(mela.queryByText(TESTO_OLTRE)).not.toBeNull();

    // Un tocco su Somma spenta non cambia niente; la conferma manda
    // "separati".
    fireEvent.click(somma);
    fireEvent.click(screen.getByRole("button", { name: "Sposta" }));
    expect(onConferma).toHaveBeenCalledWith({ "alimento-Mela": { tipo: "separati" } });
  });

  it("al limite esatto (99999,99 g) Somma resta accesa e già scelta, senza testo", () => {
    const onConferma = apri([doppione("Mela", 50000, 49999.99)]);
    const mela = blocco("Mela");

    const somma = mela.getByRole("radio", { name: /^Somma/ });
    expect((somma as HTMLButtonElement).disabled).toBe(false);
    expect(somma.getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByText(TESTO_OLTRE)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sposta" }));
    expect(onConferma).toHaveBeenCalledWith({ "alimento-Mela": { tipo: "somma" } });
  });

  it("vale per blocco: un alimento oltre il massimo non spegne Somma sugli altri", () => {
    const onConferma = apri([doppione("Mela", 50000, 50000), doppione("Pane", 100, 50)]);

    expect(blocco("Pane").getByRole("radio", { name: /^Somma/ }).getAttribute("aria-checked")).toBe("true");
    expect(blocco("Pane").queryByText(TESTO_OLTRE)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sposta" }));
    expect(onConferma).toHaveBeenCalledWith({
      "alimento-Mela": { tipo: "separati" },
      "alimento-Pane": { tipo: "somma" },
    });
  });
});
