"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { aggiungiPastoManuale, modificaPasto } from "@/lib/actions/pasti";

type Props = {
  pastoEsistente?: {
    id: string;
    nome_visualizzato: string;
    grammi: number;
    kcal: number;
    proteine: number;
    carboidrati: number;
    grassi: number;
  };
};

export default function FormNuovoPasto({ pastoEsistente }: Props) {
  const router = useRouter();
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [nome, setNome] = useState(pastoEsistente?.nome_visualizzato ?? "");
  const [grammi, setGrammi] = useState(pastoEsistente?.grammi?.toString() ?? "");
  const [kcal, setKcal] = useState(pastoEsistente?.kcal?.toString() ?? "");
  const [proteine, setProteine] = useState(pastoEsistente?.proteine?.toString() ?? "");
  const [carboidrati, setCarboidrati] = useState(pastoEsistente?.carboidrati?.toString() ?? "");
  const [grassi, setGrassi] = useState(pastoEsistente?.grassi?.toString() ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCaricamento(true);
    setErrore(null);

    const dati = {
      nome,
      grammi: parseFloat(grammi),
      kcal: parseFloat(kcal),
      proteine: parseFloat(proteine),
      carboidrati: parseFloat(carboidrati),
      grassi: parseFloat(grassi),
    };

    const risultato = pastoEsistente
      ? await modificaPasto(pastoEsistente.id, dati)
      : await aggiungiPastoManuale(dati);

    setCaricamento(false);

    if (risultato.errore) {
      setErrore(risultato.errore);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
      <div>
        <label className="block text-sm font-medium mb-1">Nome pasto</label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          className="w-full border rounded px-3 py-2"
          placeholder="es. Pasta al pomodoro"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Grammi</label>
        <input
          type="number"
          value={grammi}
          onChange={(e) => setGrammi(e.target.value)}
          required
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Kcal</label>
          <input type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Proteine (g)</label>
          <input type="number" value={proteine} onChange={(e) => setProteine(e.target.value)} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Carboidrati (g)</label>
          <input type="number" value={carboidrati} onChange={(e) => setCarboidrati(e.target.value)} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Grassi (g)</label>
          <input type="number" value={grassi} onChange={(e) => setGrassi(e.target.value)} required className="w-full border rounded px-3 py-2" />
        </div>
      </div>

      {errore && <p className="text-red-600 text-sm">{errore}</p>}

      <button
        type="submit"
        disabled={caricamento}
        className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {caricamento ? "Salvataggio..." : pastoEsistente ? "Aggiorna pasto" : "Salva pasto"}
      </button>
    </form>
  );
}