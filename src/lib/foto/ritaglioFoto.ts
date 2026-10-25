// Il ritaglio e la compressione della foto profilo (PUNTO_DI_PARTENZA.md
// §3, "Profilo", "La foto profilo"). Solo logica, niente schermate: la
// schermata del ritaglio (react-easy-crop) passa qui il quadrato scelto e
// riceve il file JPEG pronto da caricare.
//
// Due parti:
// - rettangoloRitaglio: funzione PURA, con test. Dal quadrato che
//   restituisce react-easy-crop (croppedAreaPixels, in pixel della foto
//   originale, con decimali e a volte un po' fuori dai bordi) calcola il
//   quadrato da disegnare: intero, sempre quadrato, sempre dentro la foto;
// - preparaFotoProfilo: apre il file, disegna quel quadrato su un canvas
//   e produce il JPEG. Usa le API del browser (Image, canvas) che in jsdom
//   non funzionano: non ha test automatici, si prova su iPhone.
//
// Perché Image + decode() e non createImageBitmap per aprire il file:
// - le coordinate. react-easy-crop mostra la foto con un <img>, quindi
//   croppedAreaPixels è nelle coordinate della foto come la disegna un
//   <img>: già raddrizzata secondo l'orientamento EXIF (Safari lo fa dalla
//   13.1, Chrome dalla 81). Disegnando dallo stesso tipo di oggetto le
//   coordinate sono per forza le stesse. createImageBitmap su Safari ha
//   avuto per anni problemi proprio con l'orientamento EXIF: una foto
//   verticale poteva uscire girata, o con il ritaglio spostato;
// - l'HEIC. Safari su iPhone (dalla 17) apre l'HEIC in un <img>, cioè
//   proprio quello che sa mostrare; se un browser non lo sa aprire (Chrome
//   sul PC), decode() fallisce e l'esito è "non-si-apre".
//
// Foto piccola (quadrato scelto sotto i 400 px): NON si ingrandisce, il
// file esce del lato del quadrato. Ingrandire non aggiunge dettaglio,
// rende il file più pesante e cambia poco: a schermo la foto più grande
// usa 168 pixel reali (il cerchio da 56 px dell'intestazione di Profilo,
// a 3x), e il browser la adatta da solo al cerchio. Succede solo con foto
// molto piccole: da una foto dell'iPhone (lato corto 3024 px) servirebbe
// uno zoom di più di 7 volte.
//
// Esiti come tipo unione, mai eccezioni per i casi previsti (come
// EsitoEliminazione in src/lib/account/eliminaAccount.ts).

// Il lato del file che si carica, quando la foto è abbastanza grande.
export const LATO_FOTO_PX = 400;

// Qualità del JPEG (da 0 a 1): sotto lo 0,8 sui volti si vedono i blocchi,
// sopra lo 0,9 il file cresce molto senza differenze a quella misura.
export const QUALITA_JPEG = 0.85;

// Lo stesso limite del bucket `foto-profilo` sul server (512000 byte,
// migration foto_profilo). Una foto da 400×400 pesa circa 25-60 KB: oltre
// il limite c'è qualcosa di sbagliato, e il server la rifiuterebbe.
export const LIMITE_BYTE_FOTO = 512_000;

// Il quadrato scelto, come lo dà react-easy-crop (croppedAreaPixels).
export interface AreaRitaglio {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Il quadrato da disegnare: tutti interi, dentro la foto.
export interface RettangoloRitaglio {
  sx: number; // colonna di partenza nella foto
  sy: number; // riga di partenza nella foto
  lato: number; // lato del quadrato preso dalla foto
  latoUscita: number; // lato del file: lato, ma al massimo LATO_FOTO_PX
}

function numeroValido(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n);
}

// Dal quadrato di react-easy-crop al quadrato da disegnare.
//
// Regole, in quest'ordine:
// 1. foto senza misure valide (non numeri, zero, negative) → null;
// 2. un valore dell'area non numerico (NaN, Infinity) → null: un ritaglio
//    rotto non si "aggiusta" scegliendo un'altra parte della foto a caso;
// 3. lato = il più piccolo fra larghezza e altezza dell'area (dovrebbero
//    essere uguali: con il rapporto 1:1 differiscono solo per gli
//    arrotondamenti), arrotondato; zero o negativo → null;
// 4. il lato non supera il lato corto della foto: se lo supera si
//    riduce, e il quadrato resta centrato sullo stesso punto;
// 5. il quadrato resta centrato dove l'utente l'ha messo (il centro
//    dell'area), arrotondato all'intero;
// 6. se esce dalla foto (anche di mezzo pixel, come capita con i decimali
//    della libreria) si sposta dentro, senza cambiare il lato.
export function rettangoloRitaglio(
  area: AreaRitaglio,
  foto: { larghezza: number; altezza: number }
): RettangoloRitaglio | null {
  if (!numeroValido(foto.larghezza) || !numeroValido(foto.altezza)) return null;
  const larghezza = Math.floor(foto.larghezza);
  const altezza = Math.floor(foto.altezza);
  if (larghezza < 1 || altezza < 1) return null;

  if (![area.x, area.y, area.width, area.height].every(numeroValido)) return null;

  let lato = Math.round(Math.min(area.width, area.height));
  if (lato < 1) return null;
  lato = Math.min(lato, larghezza, altezza);

  const centroX = area.x + area.width / 2;
  const centroY = area.y + area.height / 2;
  const sx = Math.min(Math.max(Math.round(centroX - lato / 2), 0), larghezza - lato);
  const sy = Math.min(Math.max(Math.round(centroY - lato / 2), 0), altezza - lato);

  return { sx, sy, lato, latoUscita: Math.min(lato, LATO_FOTO_PX) };
}

export type EsitoPreparazioneFoto =
  // Il JPEG pronto da caricare.
  | { esito: "ok"; file: Blob }
  // Il browser non sa aprire il file (non è un'immagine, è rovinato, o è
  // un formato che questo browser non legge, come l'HEIC su Chrome).
  | { esito: "non-si-apre" }
  // Il quadrato scelto non ha senso (rettangoloRitaglio → null): un errore
  // della schermata, non della foto.
  | { esito: "ritaglio-non-valido" }
  // Il browser non dà un canvas su cui disegnare, o toBlob non produce
  // niente (per esempio memoria finita).
  | { esito: "canvas-non-disponibile" }
  // Il file prodotto non è un JPEG (un browser che non sa fare JPEG dal
  // canvas ripiega sul PNG): il server lo rifiuterebbe.
  | { esito: "non-jpeg"; tipo: string }
  // Il JPEG supera il limite del bucket: il server lo rifiuterebbe.
  | { esito: "troppo-grande"; byte: number };

// Apre il file come lo mostrerebbe un <img>. null = non si apre.
async function apriFoto(file: Blob): Promise<HTMLImageElement | null> {
  const indirizzo = URL.createObjectURL(file);
  try {
    const immagine = new Image();
    immagine.src = indirizzo;
    await immagine.decode();
    if (immagine.naturalWidth < 1 || immagine.naturalHeight < 1) return null;
    return immagine;
  } catch {
    return null;
  } finally {
    // Dopo decode() l'immagine è già in memoria: l'indirizzo non serve più.
    URL.revokeObjectURL(indirizzo);
  }
}

function canvasInBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((risolvi) => {
    try {
      canvas.toBlob((blob) => risolvi(blob), "image/jpeg", QUALITA_JPEG);
    } catch {
      risolvi(null);
    }
  });
}

// Dalla foto scelta e dal quadrato scelto al JPEG da caricare.
export async function preparaFotoProfilo(
  file: Blob,
  area: AreaRitaglio
): Promise<EsitoPreparazioneFoto> {
  const immagine = await apriFoto(file);
  if (!immagine) return { esito: "non-si-apre" };

  const rettangolo = rettangoloRitaglio(area, {
    larghezza: immagine.naturalWidth,
    altezza: immagine.naturalHeight,
  });
  if (!rettangolo) return { esito: "ritaglio-non-valido" };

  // Il canvas è piccolo (al massimo 400×400) e si disegna solo il
  // quadrato scelto: niente limite di memoria del canvas di iOS, anche
  // con foto da 48 MP.
  const canvas = document.createElement("canvas");
  canvas.width = rettangolo.latoUscita;
  canvas.height = rettangolo.latoUscita;
  const contesto = canvas.getContext("2d");
  if (!contesto) return { esito: "canvas-non-disponibile" };

  // Il JPEG non ha trasparenza: le parti trasparenti di un PNG
  // diventerebbero nere. Sotto si mette il bianco. È il contenuto del
  // file, non un colore dell'interfaccia: per questo non viene dalle
  // variabili CSS del tema.
  contesto.fillStyle = "#ffffff";
  contesto.fillRect(0, 0, rettangolo.latoUscita, rettangolo.latoUscita);
  contesto.imageSmoothingEnabled = true;
  contesto.imageSmoothingQuality = "high";
  contesto.drawImage(
    immagine,
    rettangolo.sx,
    rettangolo.sy,
    rettangolo.lato,
    rettangolo.lato,
    0,
    0,
    rettangolo.latoUscita,
    rettangolo.latoUscita
  );

  // Ridisegnando si perdono tutti i dati EXIF della foto originale,
  // compresa la posizione GPS: nel file caricato non ci sono.
  const blob = await canvasInBlob(canvas);
  if (!blob) return { esito: "canvas-non-disponibile" };
  if (blob.type !== "image/jpeg") return { esito: "non-jpeg", tipo: blob.type };
  if (blob.size > LIMITE_BYTE_FOTO) return { esito: "troppo-grande", byte: blob.size };

  return { esito: "ok", file: blob };
}
