"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { aggiungiPastoManuale, modificaPasto } from "@/lib/actions/pasti";
import { leggiEtichettaFoto } from "@/lib/ocr/leggiEtichetta";
import { ValoriNutrizionali } from "@/lib/ocr/parseEtichetta";

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

  // "manuale" oppure "foto" — se stiamo modificando un pasto esistente, partiamo sempre da manuale
  const [modo, setModo] = useState<"manuale" | "foto">("manuale");

  const [nome, setNome] = useState(pastoEsistente?.nome_visualizzato ?? "");
  const [grammi, setGrammi] = useState(pastoEsistente?.grammi?.toString() ?? "");
  const [kcal, setKcal] = useState(pastoEsistente?.kcal?.toString() ?? "");
  const [proteine, setProteine] = useState(pastoEsistente?.proteine?.toString() ?? "");
  const [carboidrati, setCarboidrati] = useState(pastoEsistente?.carboidrati?.toString() ?? "");
  const [grassi, setGrassi] = useState(pastoEsistente?.grassi?.toString() ?? "");

  // Valori "per 100g" letti dall'etichetta, usati per ricalcolare in base ai grammi
  const [valoriPer100, setValoriPer100] = useState<ValoriNutrizionali | null>(null);
  const [immaginePreview, setImmaginePreview] = useState<string | null>(null);
  const [ocrInCorso, setOcrInCorso] = useState(false);

  // Ogni volta che cambiano i grammi (e abbiamo i valori per 100g), ricalcola i macro
  useEffect(() => {
    if (!valoriPer100) return;
    const g = parseFloat(grammi);
    if (isNaN(g)) return;

    const fattore = g / 100;
    if (valoriPer100.kcal !== null) setKcal((valoriPer100.kcal * fattore).toFixed(0));
    if (valoriPer100.proteine !== null) setProteine((valoriPer100.proteine * fattore).toFixed(1));
    if (valoriPer100.carboidrati !== null) setCarboidrati((valoriPer100.carboidrati * fattore).toFixed(1));
    if (valoriPer100.grassi !== null) setGrassi((valoriPer100.grassi * fattore).toFixed(1));
  }, [grammi, valoriPer100]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImmaginePreview(URL.createObjectURL(file));
    setOcrInCorso(true);
    setErrore(null);

    try {
      const { valori } = await leggiEtichettaFoto(file);
      setValoriPer100(valori);

      // Se i grammi non sono ancora impostati, mettiamo 100 come default
      // (visto che i valori dell'etichetta sono già "per 100g")
      if (!grammi) setGrammi("100");
    } catch (err) {
      setErrore("Non sono riuscito a leggere l'etichetta. Prova con una foto più nitida.");
    } finally {
      setOcrInCorso(false);
    }
  }

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
    <div className="flex flex-col gap-4 max-w-md">
      {/* Selettore modalità — nascosto se stiamo modificando un pasto esistente */}
      {!pastoEsistente && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setModo("manuale")}
            className={`px-4 py-2 rounded text-sm ${
              modo === "manuale" ? "bg-black text-white" : "border"
            }`}
          >
            Inserimento manuale
          </button>
          <button
            type="button"
            onClick={() => setModo("foto")}
            className={`px-4 py-2 rounded text-sm ${
              modo === "foto" ? "bg-black text-white" : "border"
            }`}
          >
            Foto etichetta
          </button>
        </div>
      )}

      {modo === "foto" && !pastoEsistente && (
        <div className="flex flex-col gap-2 border rounded p-3">
          <label className="block text-sm font-medium">Foto etichetta nutrizionale</label>
          <input type="file" accept="image/*" onChange={handleFileChange} />

          {immaginePreview && (
            <img src={immaginePreview} alt="Anteprima" className="max-w-full rounded border mt-2" />
          )}

          {ocrInCorso && <p className="text-sm text-gray-500">Lettura etichetta in corso...</p>}

          {valoriPer100 && !ocrInCorso && (
            <p className="text-sm text-green-700">
              Valori letti! Controlla e correggi i campi qui sotto se necessario, poi imposta i grammi consumati.
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <label className="block text-sm font-medium mb-1">Grammi consumati</label>
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
          disabled={caricamento || ocrInCorso}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {caricamento ? "Salvataggio..." : pastoEsistente ? "Aggiorna pasto" : "Salva pasto"}
        </button>
      </form>
    </div>
  );
}