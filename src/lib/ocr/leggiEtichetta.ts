// src/lib/ocr/leggiEtichetta.ts
import { createWorker, PSM } from "tesseract.js";
import { estraiValoriNutrizionali, ValoriNutrizionali } from "./parseEtichetta";

// Ridisegna l'immagine più grande su un canvas, per aiutare l'OCR con testo piccolo
async function ingrandisciImmagine(file: File, fattore: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width * fattore;
  canvas.height = bitmap.height * fattore;

  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png");
  });
}

// Funzione principale: prende il file foto, restituisce i valori nutrizionali per 100g/ml
export async function leggiEtichettaFoto(file: File): Promise<{
  testoGrezzo: string;
  valori: ValoriNutrizionali;
}> {
  const immagineIngrandita = await ingrandisciImmagine(file, 2);

  const worker = await createWorker(
    "ita",
    1,
    {
      load_system_dawg: "0",
      load_freq_dawg: "0",
    } as any
  );

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: "1",
  });

  const risultato = await worker.recognize(immagineIngrandita);
  await worker.terminate();

  const valori = estraiValoriNutrizionali(risultato.data.text);

  return { testoGrezzo: risultato.data.text, valori };
}