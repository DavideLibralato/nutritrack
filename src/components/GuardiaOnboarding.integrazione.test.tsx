// La guardia dell'onboarding con statoSegno vero (dal 17/10): cookie della
// sessione, chiave locale, Dexie e discesa sono quelli veri di jsdom e
// fake-indexeddb. Finti solo il router e il client Supabase, che qui è una
// spia: la guardia non deve fare nessuna chiamata di rete, per nessuno.
//
// Il caso che conta di più: "appena finito". L'onboarding ha scritto la
// chiave locale "fatto", il server non l'ha ancora (metadati da_fare): la
// guardia non deve riportare all'onboarding, o la pagina rimanderebbe a
// Oggi e la guardia di nuovo lì.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { stringToBase64URL } from "@supabase/ssr";
import GuardiaOnboarding from "./GuardiaOnboarding";
import { db } from "@/lib/db/database";
import { repositoryObiettivi, repositoryProfili } from "@/lib/repository";
import { chiaveSessione } from "@/lib/supabase/utenteOffline";
import { chiaveSegnoLocale } from "@/lib/onboarding/segnoOnboarding";
import { azzeraStatoGiri } from "@/lib/sync/statoSincronizzazione";

const URL_SUPABASE = "https://progetto.supabase.co";

const finti = vi.hoisted(() => ({ replace: vi.fn(), rete: [] as string[] }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: finti.replace, push: () => {}, refresh: () => {} }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    finti.rete.push("createClient");
    return new Proxy(
      {},
      {
        get: (_bersaglio, nome: string) => {
          finti.rete.push(nome);
          throw new Error(`nessuna chiamata a Supabase attesa (${nome})`);
        },
      }
    );
  },
}));

function cookieSessione(userId: string, metadati: Record<string, unknown>) {
  const valore = "base64-" + stringToBase64URL(JSON.stringify({ user: { id: userId, user_metadata: metadati } }));
  document.cookie = `${chiaveSessione(URL_SUPABASE)}=${valore}; path=/`;
}

async function obiettivo(userId: string) {
  await repositoryObiettivi.crea({
    user_id: userId,
    valido_dal: "2026-10-17",
    tipo: "mantenere",
    kcal: 2500,
    proteine_g: 180,
    carboidrati_g: 250,
    grassi_g: 80,
    peso_obiettivo: null,
  });
}

// Lascia rispondere Dexie e girare gli effetti.
const unAttimo = () => new Promise((fine) => setTimeout(fine, 50));

beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_SUPABASE);
  finti.replace.mockReset();
  finti.rete = [];
  window.localStorage.clear();
  azzeraStatoGiri();
  await Promise.all([db.profili.clear(), db.misurazioni.clear(), db.obiettivi.clear(), db.outbox.clear()]);
});

afterEach(() => {
  cleanup();
  document.cookie = `${chiaveSessione(URL_SUPABASE)}=; path=/; max-age=0`;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GuardiaOnboarding con statoSegno vero", () => {
  it("appena finito: chiave locale «fatto», metadati ancora da_fare → nessun redirect", async () => {
    cookieSessione("u1", { onboarding: "da_fare" });
    window.localStorage.setItem(chiaveSegnoLocale("u1"), "fatto");

    render(<GuardiaOnboarding />);
    await unAttimo();

    expect(finti.replace).not.toHaveBeenCalled();
    expect(finti.rete).toEqual([]);
  });

  it("da_fare con i dati non ancora noti (Dexie vuoto, nessuna discesa): redirect, senza rete", async () => {
    cookieSessione("u1", { onboarding: "da_fare" });

    render(<GuardiaOnboarding />);

    await waitFor(() => expect(finti.replace).toHaveBeenCalledWith("/onboarding"));
    expect(finti.replace).toHaveBeenCalledTimes(1);
    expect(finti.rete).toEqual([]);
  });

  it("da_fare con un obiettivo già in Dexie: la rete di sicurezza, nessun redirect", async () => {
    cookieSessione("u1", { onboarding: "da_fare" });
    await obiettivo("u1");

    render(<GuardiaOnboarding />);
    await unAttimo();

    expect(finti.replace).not.toHaveBeenCalled();
  });

  it("utente senza segno: nessun redirect, niente Dexie e niente rete", async () => {
    cookieSessione("u1", { nome: "Giulia" });
    const letture = vi.spyOn(repositoryProfili, "ottieniTutti");

    render(<GuardiaOnboarding />);
    await unAttimo();

    expect(finti.replace).not.toHaveBeenCalled();
    expect(letture).not.toHaveBeenCalled();
    expect(finti.rete).toEqual([]);
  });

  it("rimandato: nessun redirect", async () => {
    cookieSessione("u1", { onboarding: "rimandato" });
    render(<GuardiaOnboarding />);
    await unAttimo();
    expect(finti.replace).not.toHaveBeenCalled();
  });

  it("nessuna sessione salvata: niente", async () => {
    render(<GuardiaOnboarding />);
    await unAttimo();
    expect(finti.replace).not.toHaveBeenCalled();
    expect(finti.rete).toEqual([]);
  });
});
