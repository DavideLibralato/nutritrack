"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { aggiungiPastoManuale, modificaPasto } from "@/lib/actions/pasti";
import { leggiEtichettaFoto } from "@/lib/ocr/leggiEtichetta";
import { ValoriNutrizionali } from "@/lib/ocr/parseEtichetta";
import { cercaProdottoPerBarcode } from "@/lib/barcode/cercaProdotto";
import ScannerBarcode from "@/components/ScannerBarcode";

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

type Modo = "manuale" | "foto" | "barcode";

export default function FormNuovoPasto({ pastoEsistente }: Props) {
  const router = useRouter();
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [modo, setModo] = useState<Modo>("manuale");
  const [metodoSalvataggio, setMetodoSalvataggio] = useState<"manuale" | "etichetta" | "barcode">("manuale");

  const [nome, setNome] = useState(pastoEsistente?.nome_visualizzato ?? "");
  const [grammi, setGrammi] = useState(pastoEsistente?.grammi?.toString() ?? "");
  const [kcal, setKcal] = useState(pastoEsistente?.kcal?.toString() ?? "");
  const [proteine, setProteine] = useState(pastoEsistente?.proteine?.toString() ?? "");
  const [carboidrati, setCarboidrati] = useState(pastoEsistente?.carboidrati?.toString() ?? "");
  const [grassi, setGrassi] = useState(pastoEsistente?.grassi?.toString() ?? "");

  const [valoriPer100, setValoriPer100] = useState<ValoriNutrizionali | null>(null);

  // --- Stato per modalità Foto ---
  const [immaginePreview, setImmaginePreview] = useState<string | null>(null);
  const [ocrInCorso, setOcrInCorso] = useState(false);

  // --- Stato per modalità Barcode ---
  const [codiceBarcode, setCodiceBarcode] = useState("");
  const [ricercaInCorso, setRicercaInCorso] = useState(false);
  const [prodottoTrovato, setProdottoTrovato] = useState(false);

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
      setMetodoSalvataggio("etichetta");
      if (!grammi) setGrammi("100");
    } catch {
      setErrore("Non sono riuscito a leggere l'etichetta. Prova con una foto più nitida.");
    } finally {
      setOcrInCorso(false);
    }
  }

  async function cercaBarcode(codice: string) {
    if (!codice) return;
    setRicercaInCorso(true);
    setErrore(null);
    setProdottoTrovato(false);

    const prodotto = await cercaProdottoPerBarcode(codice);

    if (!prodotto || prodotto.kcal_100g === null) {
      setErrore("Prodotto non trovato o dati nutrizionali mancanti. Prova l'inserimento manuale.");
      setRicercaInCorso(false);
      return;
    }

    setNome(prodotto.nome);
    setValoriPer100({
      kcal: prodotto.kcal_100g,
      proteine: prodotto.proteine_100g,
      carboidrati: prodotto.carboidrati_100g,
      grassi: prodotto.grassi_100g,
    });
    setMetodoSalvataggio("barcode");
    if (!grammi) setGrammi("100");
    setProdottoTrovato(true);
    setRicercaInCorso(false);
  }

  // useCallback: evita che ScannerBarcode riavvii la fotocamera ad ogni render del form
  const handleCodiceTrovato = useCallback((codice: string) => {
    setCodiceBarcode(codice);
    cercaBarcode(codice);
  }, []);

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
      : await aggiungiPastoManuale(dati, metodoSalvataggio);

    setCaricamento(false);

    if (risultato.errore) {
      setErrore(risultato.errore);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="flex flex-col gap-4 max-w-md">
      {!pastoEsistente && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setModo("manuale")}
            className={`px-4 py-2 rounded text-sm ${modo === "manuale" ? "bg-black text-white" : "border"}`}
          >
            Manuale
          </button>
          <button
            type="button"
            onClick={() => setModo("foto")}
            className={`px-4 py-2 rounded text-sm ${modo === "foto" ? "bg-black text-white" : "border"}`}
          >
            Foto etichetta
          </button>
          <button
            type="button"
            onClick={() => setModo("barcode")}
            className={`px-4 py-2 rounded text-sm ${modo === "barcode" ? "bg-black text-white" : "border"}`}
          >
            Barcode
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

          {valoriPer100 && !ocrInCorso && metodoSalvataggio === "etichetta" && (
            <p className="text-sm text-green-700">
              Valori letti! Controlla e correggi i campi qui sotto se necessario.
            </p>
          )}
        </div>
      )}

      {modo === "barcode" && !pastoEsistente && (
        <div className="flex flex-col gap-2 border rounded p-3">
          <label className="block text-sm font-medium">Inquadra il codice a barre</label>
          <ScannerBarcode onCodiceTrovato={handleCodiceTrovato} />

          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={codiceBarcode}
              onChange={(e) => setCodiceBarcode(e.target.value)}
              placeholder="oppure inserisci il codice a mano"
              className="border rounded px-3 py-2 flex-1 text-sm"
            />
            <button
              type="button"
              onClick={() => cercaBarcode(codiceBarcode)}
              className="bg-black text-white rounded px-4 py-2 text-sm"
            >
              Cerca
            </button>
          </div>

          {ricercaInCorso && <p className="text-sm text-gray-500">Ricerca prodotto...</p>}

          {prodottoTrovato && !ricercaInCorso && (
            <p className="text-sm text-green-700">
              Prodotto trovato! Controlla e correggi i campi qui sotto se necessario.
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
          disabled={caricamento || ocrInCorso || ricercaInCorso}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {caricamento ? "Salvataggio..." : pastoEsistente ? "Aggiorna pasto" : "Salva pasto"}
        </button>
      </form>
    </div>
  );
}