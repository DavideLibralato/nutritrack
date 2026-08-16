// src/lib/ai/stimaPasto.ts
"use server";

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type StimaNutrizionale = {
  nome: string;
  grammi: number;
  kcal: number;
  proteine: number;
  carboidrati: number;
  grassi: number;
};

const ISTRUZIONI = `Sei un esperto di nutrizione. Analizza la descrizione o la foto di un pasto
e stima il peso della porzione e i valori nutrizionali TOTALI per quella porzione (non per 100g).
Rispondi SOLO con un oggetto JSON, senza testo aggiuntivo, in questo formato esatto:
{"nome": "nome breve del piatto in italiano", "grammi": numero, "kcal": numero, "proteine": numero, "carboidrati": numero, "grassi": numero}
"grammi" è il peso stimato della porzione. Gli altri numeri sono grammi (tranne kcal). Se non sei sicuro, fai la stima più ragionevole possibile.`;

function estraiJson(testo: string): StimaNutrizionale {
  const pulito = testo.replace(/```json|```/g, "").trim();
  return JSON.parse(pulito);
}

function attesa(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Esegue una richiesta a Gemini, riprovando automaticamente se i server sono momentaneamente occupati (errore 503)
async function chiamaConRiprova(contents: any, tentativi = 3): Promise<string> {
  for (let i = 0; i < tentativi; i++) {
    try {
      const risposta = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents,
      });
      return risposta.text ?? "";
    } catch (err: any) {
      const ultimoTentativo = i === tentativi - 1;
      if (err?.status === 503 && !ultimoTentativo) {
        await attesa(1500 * (i + 1)); // aspetta un po' di più ad ogni tentativo
        continue;
      }
      throw err;
    }
  }
  throw new Error("Impossibile contattare il servizio AI dopo vari tentativi");
}

export async function stimaDaTesto(descrizione: string): Promise<StimaNutrizionale> {
  const testo = await chiamaConRiprova(
    `${ISTRUZIONI}\n\nDescrizione del pasto: ${descrizione}`
  );
  return estraiJson(testo);
}

export async function stimaDaFoto(base64Immagine: string, mimeType: string): Promise<StimaNutrizionale> {
  const testo = await chiamaConRiprova([
    { text: ISTRUZIONI },
    {
      inlineData: {
        mimeType,
        data: base64Immagine,
      },
    },
  ]);
  return estraiJson(testo);
}