"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { aggiungiPastoManuale, modificaPasto } from "@/lib/actions/pasti";
import { leggiEtichettaFoto } from "@/lib/ocr/leggiEtichetta";
import { ValoriNutrizionali } from "@/lib/ocr/parseEtichetta";
import { cercaProdottoPerBarcode } from "@/lib/barcode/cercaProdotto";
import { stimaDaFoto, stimaDaTesto } from "@/lib/ai/stimaPasto";
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

type Modo = "manuale" | "foto" | "barcode" | "foto_ai" | "testo_ai";
type Metodo = "manuale" | "etichetta" | "barcode" | "foto_ai" | "testo_ai";

const CLASSE_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

// Ridimensiona l'immagine (se troppo grande) e la converte in base64
function fileInBase64Ridimensionato(file: File, latoMassimo = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    createImageBitmap(file).then((bitmap) => {
      let { width, height } = bitmap;

      // Riduce solo se l'immagine supera il lato massimo consentito
      if (width > latoMassimo || height > latoMassimo) {
        const scala = latoMassimo / Math.max(width, height);
        width = Math.round(width * scala);
        height = Math.round(height * scala);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0, width, height);

      // Qualità 0.8 = buon compromesso tra peso e nitidezza per una foto di cibo
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      resolve(dataUrl.split(",")[1]);
    }).catch(reject);
  });
}

// Piccolo link "via di fuga": permette di saltare subito ai campi manuali
// invece di aspettare/fidarsi di OCR, barcode o AI. Utile sia se il
// riconoscimento fallisce, sia per chi preferisce inserire i valori a mano.
function LinkInserisciManualmente({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs underline text-left text-muted w-fit rounded ${CLASSE_FOCUS}`}
    >
      Inserisci i valori manualmente
    </button>
  );
}

export default function FormNuovoPasto({ pastoEsistente }: Props) {
  const router = useRouter();
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [modo, setModo] = useState<Modo>("manuale");
  const [metodoSalvataggio, setMetodoSalvataggio] = useState<Metodo>("manuale");

  // Permette di saltare subito ai campi manuali anche prima che
  // OCR/barcode/AI abbiano prodotto un risultato (vedi LinkInserisciManualmente).
  const [mostraManualeForzato, setMostraManualeForzato] = useState(false);

  const [nome, setNome] = useState(pastoEsistente?.nome_visualizzato ?? "");
  const [grammi, setGrammi] = useState(pastoEsistente?.grammi?.toString() ?? "");
  const [kcal, setKcal] = useState(pastoEsistente?.kcal?.toString() ?? "");
  const [proteine, setProteine] = useState(pastoEsistente?.proteine?.toString() ?? "");
  const [carboidrati, setCarboidrati] = useState(pastoEsistente?.carboidrati?.toString() ?? "");
  const [grassi, setGrassi] = useState(pastoEsistente?.grassi?.toString() ?? "");

  const [valoriPer100, setValoriPer100] = useState<ValoriNutrizionali | null>(null);

  // --- Stato per modalità Foto etichetta (OCR) ---
  const [immaginePreview, setImmaginePreview] = useState<string | null>(null);
  const [ocrInCorso, setOcrInCorso] = useState(false);

  // --- Stato per modalità Barcode ---
  const [codiceBarcode, setCodiceBarcode] = useState("");
  const [ricercaInCorso, setRicercaInCorso] = useState(false);
  const [prodottoTrovato, setProdottoTrovato] = useState(false);

  // --- Stato per modalità Foto AI ---
  const [immagineAiPreview, setImmagineAiPreview] = useState<string | null>(null);
  const [stimaAiInCorso, setStimaAiInCorso] = useState(false);

  // --- Stato per modalità Testo AI ---
  const [descrizioneLibera, setDescrizioneLibera] = useState("");

  // Cambia modalità e azzera lo "sblocco manuale forzato": ogni metodo
  // riparte dal proprio stato di attesa invece di trascinarsi la scelta
  // fatta nella modalità precedente.
  function selezionaModo(nuovoModo: Modo) {
    setModo(nuovoModo);
    setMostraManualeForzato(false);
  }

  // Ricalcola i macro in base ai grammi SOLO per etichetta/barcode
  // (per la stima AI i valori sono già totali per la porzione, niente da ricalcolare)
  useEffect(() => {
    if (!valoriPer100) return;
    if (metodoSalvataggio !== "etichetta" && metodoSalvataggio !== "barcode") return;

    const g = parseFloat(grammi);
    if (isNaN(g)) return;

    const fattore = g / 100;
    if (valoriPer100.kcal !== null) setKcal((valoriPer100.kcal * fattore).toFixed(0));
    if (valoriPer100.proteine !== null) setProteine((valoriPer100.proteine * fattore).toFixed(1));
    if (valoriPer100.carboidrati !== null) setCarboidrati((valoriPer100.carboidrati * fattore).toFixed(1));
    if (valoriPer100.grassi !== null) setGrassi((valoriPer100.grassi * fattore).toFixed(1));
  }, [grammi, valoriPer100, metodoSalvataggio]);

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

  const handleCodiceTrovato = useCallback((codice: string) => {
    setCodiceBarcode(codice);
    cercaBarcode(codice);
  }, []);

  async function handleFotoAiChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImmagineAiPreview(URL.createObjectURL(file));
    setStimaAiInCorso(true);
    setErrore(null);

    try {
      const base64 = await fileInBase64Ridimensionato(file);
      const stima = await stimaDaFoto(base64, "image/jpeg");

      setNome(stima.nome);
      setGrammi(stima.grammi.toString());
      setKcal(stima.kcal.toString());
      setProteine(stima.proteine.toString());
      setCarboidrati(stima.carboidrati.toString());
      setGrassi(stima.grassi.toString());
      setMetodoSalvataggio("foto_ai");
    } catch {
      setErrore("Non sono riuscito a stimare i valori dalla foto. Riprova o usa un altro metodo.");
    } finally {
      setStimaAiInCorso(false);
    }
  }

  async function handleStimaTesto() {
    if (!descrizioneLibera.trim()) return;
    setStimaAiInCorso(true);
    setErrore(null);

    try {
      const stima = await stimaDaTesto(descrizioneLibera);

      setNome(stima.nome);
      setGrammi(stima.grammi.toString());
      setKcal(stima.kcal.toString());
      setProteine(stima.proteine.toString());
      setCarboidrati(stima.carboidrati.toString());
      setGrassi(stima.grassi.toString());
      // Prima veniva salvato come "foto_ai" per errore: cosi il metodo
      // registrato riflette davvero che il testo, non una foto, ha generato la stima.
      setMetodoSalvataggio("testo_ai");
    } catch {
      setErrore("Non sono riuscito a stimare i valori dal testo. Riprova o usa un altro metodo.");
    } finally {
      setStimaAiInCorso(false);
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
      : await aggiungiPastoManuale(dati, metodoSalvataggio);

    setCaricamento(false);

    if (risultato.errore) {
      setErrore(risultato.errore);
      return;
    }

    router.push("/dashboard");
  }

  const inCorso = ocrInCorso || ricercaInCorso || stimaAiInCorso;
  const usaGrammiPerRicalcolo = metodoSalvataggio === "etichetta" || metodoSalvataggio === "barcode";

  // Il metodo scelto ha gia' prodotto un risultato utilizzabile?
  const risultatoPronto =
    (modo === "foto" && metodoSalvataggio === "etichetta" && valoriPer100 !== null && !ocrInCorso) ||
    (modo === "barcode" && prodottoTrovato && !ricercaInCorso) ||
    (modo === "foto_ai" && metodoSalvataggio === "foto_ai" && !stimaAiInCorso) ||
    (modo === "testo_ai" && metodoSalvataggio === "testo_ai" && !stimaAiInCorso);

  // I campi manuali si vedono solo se: si sta modificando un pasto esistente,
  // si e' scelto "Manuale" da subito, il metodo scelto ha gia' dato un risultato,
  // oppure l'utente ha chiesto esplicitamente di saltare al modulo manuale.
  const mostraCampiManuali =
    !!pastoEsistente || modo === "manuale" || mostraManualeForzato || risultatoPronto;

  return (
    <div className="flex flex-col gap-4 max-w-md">
      {!pastoEsistente && (
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => selezionaModo("manuale")} className={`px-3 py-2 rounded-lg text-sm ${modo === "manuale" ? "bg-foreground text-background" : "border border-border"} ${CLASSE_FOCUS}`}>
            Manuale
          </button>
          <button type="button" onClick={() => selezionaModo("foto")} className={`px-3 py-2 rounded-lg text-sm ${modo === "foto" ? "bg-foreground text-background" : "border border-border"} ${CLASSE_FOCUS}`}>
            Foto etichetta
          </button>
          <button type="button" onClick={() => selezionaModo("barcode")} className={`px-3 py-2 rounded-lg text-sm ${modo === "barcode" ? "bg-foreground text-background" : "border border-border"} ${CLASSE_FOCUS}`}>
            Barcode
          </button>
          <button type="button" onClick={() => selezionaModo("foto_ai")} className={`px-3 py-2 rounded-lg text-sm ${modo === "foto_ai" ? "bg-foreground text-background" : "border border-border"} ${CLASSE_FOCUS}`}>
            Foto cibo (AI)
          </button>
          <button type="button" onClick={() => selezionaModo("testo_ai")} className={`px-3 py-2 rounded-lg text-sm ${modo === "testo_ai" ? "bg-foreground text-background" : "border border-border"} ${CLASSE_FOCUS}`}>
            Descrivi (AI)
          </button>
        </div>
      )}

      {modo === "foto" && !pastoEsistente && (
        <div className="flex flex-col gap-2 border border-border rounded-xl p-3">
          <label htmlFor="ocr-file" className="block text-sm font-medium">Foto etichetta nutrizionale</label>
          <input id="ocr-file" type="file" accept="image/*" onChange={handleFileChange} className={`rounded ${CLASSE_FOCUS}`} />
          {immaginePreview && <img src={immaginePreview} alt="Anteprima etichetta caricata" className="max-w-full rounded-lg border border-border mt-2" />}
          {ocrInCorso && <p className="text-sm text-muted">Lettura etichetta in corso...</p>}
          {valoriPer100 && !ocrInCorso && metodoSalvataggio === "etichetta" && (
            <p className="text-sm text-green-700">Valori letti! Controlla e correggi i campi qui sotto se necessario.</p>
          )}
          {!mostraCampiManuali && !ocrInCorso && (
            <LinkInserisciManualmente onClick={() => setMostraManualeForzato(true)} />
          )}
        </div>
      )}

      {modo === "barcode" && !pastoEsistente && (
        <div className="flex flex-col gap-2 border border-border rounded-xl p-3">
          <label className="block text-sm font-medium">Inquadra il codice a barre</label>
          <ScannerBarcode onCodiceTrovato={handleCodiceTrovato} />
          <div className="flex gap-2 mt-2">
            <label htmlFor="barcode-manuale" className="sr-only">
              Codice a barre
            </label>
            <input
              id="barcode-manuale"
              type="text"
              value={codiceBarcode}
              onChange={(e) => setCodiceBarcode(e.target.value)}
              placeholder="oppure inserisci il codice a mano"
              className={`border border-border rounded-lg px-3 py-2 flex-1 text-sm ${CLASSE_FOCUS}`}
            />
            <button type="button" onClick={() => cercaBarcode(codiceBarcode)} className={`bg-foreground text-background rounded-lg px-4 py-2 text-sm ${CLASSE_FOCUS}`}>
              Cerca
            </button>
          </div>
          {ricercaInCorso && <p className="text-sm text-muted">Ricerca prodotto...</p>}
          {prodottoTrovato && !ricercaInCorso && (
            <p className="text-sm text-green-700">Prodotto trovato! Controlla e correggi i campi qui sotto se necessario.</p>
          )}
          {!mostraCampiManuali && !ricercaInCorso && (
            <LinkInserisciManualmente onClick={() => setMostraManualeForzato(true)} />
          )}
        </div>
      )}

      {modo === "foto_ai" && !pastoEsistente && (
        <div className="flex flex-col gap-2 border border-border rounded-xl p-3">
          <label htmlFor="ai-foto-file" className="block text-sm font-medium">Foto del piatto (es. al ristorante)</label>
          <input id="ai-foto-file" type="file" accept="image/*" onChange={handleFotoAiChange} className={`rounded ${CLASSE_FOCUS}`} />
          {immagineAiPreview && <img src={immagineAiPreview} alt="Anteprima piatto fotografato" className="max-w-full rounded-lg border border-border mt-2" />}
          {stimaAiInCorso && <p className="text-sm text-muted">Stima AI in corso...</p>}
          {metodoSalvataggio === "foto_ai" && !stimaAiInCorso && (
            <p className="text-sm text-green-700">Stima ricevuta! È una stima approssimativa: controlla e correggi i valori.</p>
          )}
          {!mostraCampiManuali && !stimaAiInCorso && (
            <LinkInserisciManualmente onClick={() => setMostraManualeForzato(true)} />
          )}
        </div>
      )}

      {modo === "testo_ai" && !pastoEsistente && (
        <div className="flex flex-col gap-2 border border-border rounded-xl p-3">
          <label htmlFor="ai-testo" className="block text-sm font-medium">Descrivi cosa hai mangiato</label>
          <textarea
            id="ai-testo"
            value={descrizioneLibera}
            onChange={(e) => setDescrizioneLibera(e.target.value)}
            placeholder="es. 150g di pasta al pomodoro con un cucchiaio di parmigiano"
            className={`border border-border rounded-lg px-3 py-2 text-sm ${CLASSE_FOCUS}`}
            rows={3}
          />
          <button
            type="button"
            onClick={handleStimaTesto}
            disabled={stimaAiInCorso}
            className={`bg-foreground text-background rounded-lg px-4 py-2 text-sm disabled:opacity-50 ${CLASSE_FOCUS}`}
          >
            {stimaAiInCorso ? "Stima in corso..." : "Stima valori"}
          </button>
          {metodoSalvataggio === "testo_ai" && !stimaAiInCorso && (
            <p className="text-sm text-green-700">Stima ricevuta! È una stima approssimativa: controlla e correggi i valori.</p>
          )}
          {!mostraCampiManuali && !stimaAiInCorso && (
            <LinkInserisciManualmente onClick={() => setMostraManualeForzato(true)} />
          )}
        </div>
      )}

      {mostraCampiManuali && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="pasto-nome" className="block text-sm font-medium mb-1">Nome pasto</label>
            <input
              id="pasto-nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className={`w-full border border-border rounded-lg px-3 py-2 ${CLASSE_FOCUS}`}
              placeholder="es. Pasta al pomodoro"
            />
          </div>

          <div>
            <label htmlFor="pasto-grammi" className="block text-sm font-medium mb-1">Grammi</label>
            <input
              id="pasto-grammi"
              type="number"
              value={grammi}
              onChange={(e) => setGrammi(e.target.value)}
              required
              min={0}
              className={`w-full border border-border rounded-lg px-3 py-2 ${CLASSE_FOCUS}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pasto-kcal" className="block text-sm font-medium mb-1">Kcal</label>
              <input id="pasto-kcal" type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} required min={0} className={`w-full border border-border rounded-lg px-3 py-2 ${CLASSE_FOCUS}`} />
            </div>
            <div>
              <label htmlFor="pasto-proteine" className="block text-sm font-medium mb-1">Proteine (g)</label>
              <input id="pasto-proteine" type="number" value={proteine} onChange={(e) => setProteine(e.target.value)} required min={0} className={`w-full border border-border rounded-lg px-3 py-2 ${CLASSE_FOCUS}`} />
            </div>
            <div>
              <label htmlFor="pasto-carboidrati" className="block text-sm font-medium mb-1">Carboidrati (g)</label>
              <input id="pasto-carboidrati" type="number" value={carboidrati} onChange={(e) => setCarboidrati(e.target.value)} required min={0} className={`w-full border border-border rounded-lg px-3 py-2 ${CLASSE_FOCUS}`} />
            </div>
            <div>
              <label htmlFor="pasto-grassi" className="block text-sm font-medium mb-1">Grassi (g)</label>
              <input id="pasto-grassi" type="number" value={grassi} onChange={(e) => setGrassi(e.target.value)} required min={0} className={`w-full border border-border rounded-lg px-3 py-2 ${CLASSE_FOCUS}`} />
            </div>
          </div>

          {errore && <p className="text-red-600 text-sm">{errore}</p>}

          <button
            type="submit"
            disabled={caricamento || inCorso}
            className={`bg-foreground text-background rounded-lg px-4 py-2 disabled:opacity-50 ${CLASSE_FOCUS}`}
          >
            {caricamento ? "Salvataggio..." : pastoEsistente ? "Aggiorna pasto" : "Salva pasto"}
          </button>
        </form>
      )}

      {/* Errori di ricerca/stima (es. barcode non trovato) vanno mostrati anche
          se i campi manuali sono ancora nascosti, altrimenti l'utente non li vede */}
      {!mostraCampiManuali && errore && <p className="text-red-600 text-sm">{errore}</p>}
    </div>
  );
}
