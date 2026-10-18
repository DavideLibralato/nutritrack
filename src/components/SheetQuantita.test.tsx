// Il campo dei grammi si apre già compilato e si conferma senza toccarlo
// (PUNTO_DI_PARTENZA.md, sezione 9.3): quello che mostra è anche quello che
// si salva. Con String() una voce da 12,5 g si apriva con "12.5"; con il
// punto delle migliaia di formattaGrammi, 12.500 g si aprirebbe con
// "12.500" e un Salva senza guardare la porterebbe a 12,5 g. Errori che
// non fanno rumore.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SheetQuantita from "./SheetQuantita";
import type { AlimentoPerSheet } from "@/lib/inserimento/alimentoPerSheet";

afterEach(cleanup);

function alimento(porzione_default_g: number): AlimentoPerSheet {
  return {
    alimento_id: "a1",
    nome: "Burro",
    kcal_100g: 717,
    proteine_100g: 0.9,
    carboidrati_100g: 0.1,
    grassi_100g: 81,
    porzione_default_g,
  };
}

function apri(porzione: number, opzioni: { grammiIniziali?: number; modifica?: boolean } = {}) {
  const onConferma = vi.fn();
  render(
    <SheetQuantita
      alimento={alimento(porzione)}
      nomePasto="Colazione"
      grammiIniziali={opzioni.grammiIniziali}
      modifica={opzioni.modifica}
      onAnnulla={() => {}}
      onConferma={onConferma}
    />
  );
  return {
    campo: screen.getByLabelText("Quantità (g)") as HTMLInputElement,
    conferma: screen.getByRole("button", { name: opzioni.modifica ? "Salva" : "Aggiungi" }),
    onConferma,
  };
}

describe("SheetQuantita, grammi precompilati", () => {
  it("una voce da 12,5 g si apre con «12,5» e si risalva a 12,5 g", () => {
    const { campo, conferma, onConferma } = apri(12.5, { grammiIniziali: 12.5, modifica: true });
    expect(campo.value).toBe("12,5");
    fireEvent.click(conferma);
    expect(onConferma).toHaveBeenCalledWith(12.5);
  });

  it("porzione predefinita 100: «100», non «100,00»", () => {
    const { campo, conferma, onConferma } = apri(100);
    expect(campo.value).toBe("100");
    fireEvent.click(conferma);
    expect(onConferma).toHaveBeenCalledWith(100);
  });

  it("porzione predefinita decimale: «0,5»", () => {
    const { campo, conferma, onConferma } = apri(0.5);
    expect(campo.value).toBe("0,5");
    fireEvent.click(conferma);
    expect(onConferma).toHaveBeenCalledWith(0.5);
  });

  it("da 10.000 g in su niente punto delle migliaia: si risalva lo stesso numero", () => {
    const { campo, conferma, onConferma } = apri(12500.25, { grammiIniziali: 12500.25, modifica: true });
    expect(campo.value).toBe("12500,25");
    fireEvent.click(conferma);
    expect(onConferma).toHaveBeenCalledWith(12500.25);
  });
});
