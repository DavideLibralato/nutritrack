"use client";

// "Registra peso" in Profilo: un campo con il suo pulsante, che salva SUBITO
// in misurazioni — fuori dal Salva unico del modulo. La regola da leggere
// nella pagina: Salva riguarda i campi del modulo; il peso è una
// misurazione del giorno, non un'impostazione, e ha il suo pulsante.
//
// Riusa registraPesoSenzaDuplicati: una seconda pesata nello stesso giorno
// aggiorna quella di oggi invece di aggiungere una riga.
//
// È un <form> a sé (Invio nel campo = Registra). La pagina Profilo non ha un
// <form> esterno, quindi non ci sono form annidati.

import { useState } from "react";
import { registraPesoSenzaDuplicati } from "@/lib/repository/misurazioni";
import { numeroDaCampo } from "@/lib/profilo/salvataggioProfilo";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import type { Misurazione } from "@/lib/db/tipi";

export default function RegistraPeso({
  userId,
  misurazioniPeso,
}: {
  userId: string;
  misurazioniPeso: Misurazione[];
}) {
  const [valore, setValore] = useState("");
  const [stato, setStato] = useState<
    { fase: "inattivo" } | { fase: "in-corso" } | { fase: "esito"; riuscito: boolean; testo: string }
  >({ fase: "inattivo" });

  async function registra(e: React.FormEvent) {
    e.preventDefault();
    const kg = numeroDaCampo(valore);
    if (Number.isNaN(kg) || kg <= 0 || kg > 500) {
      setStato({ fase: "esito", riuscito: false, testo: "Scrivi il peso in kg, per esempio 78,4." });
      return;
    }

    setStato({ fase: "in-corso" });
    try {
      await registraPesoSenzaDuplicati(userId, Math.round(kg * 10) / 10, misurazioniPeso);
      setValore("");
      setStato({
        fase: "esito",
        riuscito: true,
        testo: `Registrato: ${kg.toLocaleString("it-IT", { maximumFractionDigits: 1 })} kg oggi.`,
      });
    } catch {
      setStato({ fase: "esito", riuscito: false, testo: "Registrazione non riuscita. Riprova." });
    }
  }

  return (
    <form
      onSubmit={registra}
      aria-label="Registra peso"
      className="w-full max-w-sm space-y-2 rounded-xl border border-border p-4"
    >
      <label htmlFor="profilo-registra-peso" className="block text-xl font-display font-bold">
        Registra peso
      </label>
      <div className="flex gap-3">
        <input
          id="profilo-registra-peso"
          type="text"
          inputMode="decimal"
          placeholder="kg"
          value={valore}
          onChange={(e) => {
            setValore(e.target.value);
            if (stato.fase === "esito") setStato({ fase: "inattivo" });
          }}
          className={`min-w-0 flex-1 rounded-lg border border-border bg-background p-2 text-base ${CLASSE_FOCUS}`}
        />
        <button
          type="submit"
          disabled={stato.fase === "in-corso" || valore.trim() === ""}
          className={`rounded-lg border border-accent px-4 py-2 text-accent disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {stato.fase === "in-corso" ? "Registro..." : "Registra"}
        </button>
      </div>
      <p className="text-sm text-muted">Si registra subito, senza il pulsante Salva.</p>
      <div role="status">
        {stato.fase === "esito" && (
          <p className={`text-sm ${stato.riuscito ? "text-accent" : "text-warning"}`}>
            {stato.testo}
          </p>
        )}
      </div>
    </form>
  );
}
