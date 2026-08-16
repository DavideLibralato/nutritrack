// src/lib/ocr/parseEtichetta.ts

export type ValoriNutrizionali = {
  kcal: number | null;
  proteine: number | null;
  carboidrati: number | null;
  grassi: number | null;
};

// Estrae il primo numero trovato in una riga di testo (gestisce sia virgola che punto decimale)
function trovaNumero(riga: string): number | null {
  const match = riga.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  return parseFloat(match[1].replace(",", "."));
}

// Cerca la riga che INIZIA con una parola chiave, escludendo le righe "di cui ..."
// (es. vogliamo "Carboidrati 13,7g", non "di cui zuccheri 13,7g")
function trovaRiga(righe: string[], parolaChiave: string): string | undefined {
  return righe.find((riga) => {
    const r = riga.trim().toLowerCase();
    return r.startsWith(parolaChiave.toLowerCase()) && !r.includes("di cui");
  });
}

export function estraiValoriNutrizionali(testoOcr: string): ValoriNutrizionali {
  const righe = testoOcr.split("\n").filter((r) => r.trim() !== "");

  // Kcal: cerchiamo specificamente la parola "kcal" (non "kJ", che è un'altra unità)
  const rigaKcal = righe.find((r) => /kcal/i.test(r));
  const kcalMatch = rigaKcal?.match(/(\d+(?:[.,]\d+)?)\s*kcal/i);
  const kcal = kcalMatch ? parseFloat(kcalMatch[1].replace(",", ".")) : null;

  const rigaProteine = trovaRiga(righe, "proteine");
  const proteine = rigaProteine ? trovaNumero(rigaProteine) : null;

  const rigaCarboidrati = trovaRiga(righe, "carboidrati");
  const carboidrati = rigaCarboidrati ? trovaNumero(rigaCarboidrati) : null;

  const rigaGrassi = trovaRiga(righe, "grassi");
  const grassi = rigaGrassi ? trovaNumero(rigaGrassi) : null;

  return { kcal, proteine, carboidrati, grassi };
}