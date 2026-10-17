// La guardia dell'onboarding in (app)/layout.tsx (dal 17/10), con lo stato
// finto. Sbaglia in silenzio: un redirect ripetuto a ogni disegno, o uno
// che parte per chi non deve, porta in giro fra Oggi e /onboarding.
// L'integrazione con statoSegno vero sta in
// GuardiaOnboarding.integrazione.test.tsx.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import GuardiaOnboarding from "./GuardiaOnboarding";
import type { StatoSegno } from "@/lib/onboarding/statoOnboarding";

const finti = vi.hoisted(() => ({
  candidato: "u1" as string | null,
  stato: undefined as StatoSegno | undefined,
  replace: vi.fn(),
  per: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: finti.replace, push: () => {}, refresh: () => {} }),
}));
vi.mock("@/lib/onboarding/segnoOnboarding", () => ({
  iscriviSegnoLocale: () => () => {},
  utenteConOnboardingDaFare: () => finti.candidato,
}));
vi.mock("@/lib/onboarding/useStatoOnboarding", () => ({
  useStatoOnboardingPer: (...args: unknown[]) => {
    finti.per(...args);
    return finti.stato;
  },
}));

function stato(campi: Partial<StatoSegno>): StatoSegno {
  return { segno: "da_fare", mostraOnboarding: false, mostraScheda: false, attendiDiscesa: false, ...campi };
}

beforeEach(() => {
  finti.candidato = "u1";
  finti.stato = undefined;
  finti.replace.mockReset();
  finti.per.mockReset();
});

afterEach(cleanup);

describe("GuardiaOnboarding", () => {
  it("stato non ancora noto: nessun redirect", () => {
    render(<GuardiaOnboarding />);
    expect(finti.replace).not.toHaveBeenCalled();
  });

  it("mostraOnboarding: un redirect a /onboarding, uno solo anche dopo più giri di disegno", () => {
    finti.stato = stato({ mostraOnboarding: true });
    const { rerender } = render(<GuardiaOnboarding />);
    rerender(<GuardiaOnboarding />);
    // Lo stato cambia e torna: è sempre lo stesso montaggio.
    finti.stato = stato({ mostraOnboarding: true, attendiDiscesa: true });
    rerender(<GuardiaOnboarding />);
    finti.stato = undefined;
    rerender(<GuardiaOnboarding />);
    finti.stato = stato({ mostraOnboarding: true });
    rerender(<GuardiaOnboarding />);

    expect(finti.replace).toHaveBeenCalledTimes(1);
    expect(finti.replace).toHaveBeenCalledWith("/onboarding");
  });

  it("nessun segno, fatto, rimandato: nessun redirect", () => {
    for (const s of [
      stato({ segno: null }),
      stato({ segno: "fatto" }),
      stato({ segno: "rimandato", mostraScheda: true }),
    ]) {
      finti.stato = s;
      render(<GuardiaOnboarding />);
      cleanup();
    }
    expect(finti.replace).not.toHaveBeenCalled();
  });

  it("passa al cuore l'utente e il segno «da_fare» solo se il cookie dice da fare", () => {
    render(<GuardiaOnboarding />);
    expect(finti.per).toHaveBeenLastCalledWith("u1", "da_fare");
    cleanup();

    finti.candidato = null;
    render(<GuardiaOnboarding />);
    expect(finti.per).toHaveBeenLastCalledWith(null, null);
  });
});
