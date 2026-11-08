// Come si consegna un file esportato all'utente (PUNTO_DI_PARTENZA.md
// §10.4, "Salvare il file su iPhone"). Le strade, nell'ordine:
// 1. la condivisione con il file (Web Share API: su iPhone il foglio di
//    iOS, con «Salva su File»), se canShare({ files }) accetta il tipo vero
//    ("application/json", "text/csv");
// 2. lo stesso file come "text/plain", con la stessa estensione: alcuni
//    browser accettano nella condivisione solo un elenco chiuso di tipi;
// 3. il download con un link <a download>, solo fuori dall'app installata
//    (PC, Safari non installato: da verificare su iPhone). Nell'app
//    installata dalla Home il download apriva il file senza un modo per
//    tornare indietro: lì niente download, ma un messaggio con il motivo.
//
// LA CONDIVISIONE VUOLE UN TOCCO APPENA FATTO. navigator.share() si può
// chiamare solo subito dopo il tocco dell'utente: un'attesa in mezzo
// (leggere Dexie, la foto) la fa rifiutare con NotAllowedError. Per questo
// il file si prepara prima, e salvaFile arriva a navigator.share() senza
// nessun await davanti.
//
// Concetto nuovo: Web Share API. navigator.canShare(dati) chiede al
// browser "sapresti condividere questo?" e risponde sì o no subito;
// navigator.share(dati) apre il foglio di sistema e si risolve quando
// l'utente ha scelto dove mandarlo, o si rifiuta con AbortError se lo
// chiude senza scegliere.

export const TIPO_JSON = "application/json";
export const TIPO_CSV = "text/csv";
const TIPO_RISERVA = "text/plain";

// Quello che serve sapere del browser: passato da fuori, così i test lo
// inventano.
export interface AmbienteSalvataggio {
  canShare?: (dati: { files: File[] }) => boolean;
  share?: (dati: { files: File[] }) => Promise<void>;
  // L'app gira installata dalla Home (display-mode standalone).
  installata: boolean;
  // Il link <a download> si può usare.
  scarica?: (file: File) => void;
}

export type StradaSalvataggio =
  | { tipo: "condividi"; file: File }
  | { tipo: "scarica"; file: File }
  | { tipo: "impossibile"; motivo: "app-installata" | "non-supportato" };

export type EsitoSalvataggio =
  // Condiviso (l'utente ha scelto dove) o download avviato.
  | { esito: "salvato"; strada: "condividi" | "scarica" }
  // L'utente ha chiuso il foglio senza scegliere: non cambia niente.
  | { esito: "annullato" }
  // La condivisione è stata rifiutata per un altro motivo ("NotAllowedError"
  // se il tocco era troppo lontano, ...).
  | { esito: "errore"; nome: string }
  | { esito: "impossibile"; motivo: "app-installata" | "non-supportato" };

// Il nome di un errore da qualunque oggetto con una proprietà `name` di
// tipo stringa. Su Safari share() rifiuta con una DOMException, che non in
// tutte le versioni è instanceof Error: con instanceof un foglio annullato
// (AbortError) diventerebbe un errore. "Error" se il nome non c'è.
export function nomeErrore(errore: unknown): string {
  if (typeof errore === "object" && errore !== null && "name" in errore) {
    const nome = (errore as { name: unknown }).name;
    if (typeof nome === "string" && nome !== "") return nome;
  }
  return "Error";
}

function puoCondividere(ambiente: AmbienteSalvataggio, file: File): boolean {
  if (!ambiente.canShare || !ambiente.share) return false;
  try {
    return ambiente.canShare({ files: [file] });
  } catch {
    return false;
  }
}

// Funzione pura (a parte la creazione dei File): sceglie la strada.
export function sceltaStrada(
  ambiente: AmbienteSalvataggio,
  nome: string,
  testo: string,
  tipo: string
): StradaSalvataggio {
  const vero = new File([testo], nome, { type: tipo });
  if (puoCondividere(ambiente, vero)) return { tipo: "condividi", file: vero };

  const riserva = new File([testo], nome, { type: TIPO_RISERVA });
  if (puoCondividere(ambiente, riserva)) return { tipo: "condividi", file: riserva };

  if (ambiente.installata) return { tipo: "impossibile", motivo: "app-installata" };
  if (ambiente.scarica) return { tipo: "scarica", file: vero };
  return { tipo: "impossibile", motivo: "non-supportato" };
}

// Va chiamata direttamente dal tocco sul pulsante, con il testo già pronto.
export function salvaFile(
  ambiente: AmbienteSalvataggio,
  nome: string,
  testo: string,
  tipo: string
): Promise<EsitoSalvataggio> {
  const strada = sceltaStrada(ambiente, nome, testo, tipo);

  if (strada.tipo === "condividi") {
    // Nessun await prima di share: è ancora il tempo del tocco.
    return ambiente.share!({ files: [strada.file] }).then(
      (): EsitoSalvataggio => ({ esito: "salvato", strada: "condividi" }),
      (errore: unknown): EsitoSalvataggio => {
        const nome = nomeErrore(errore);
        return nome === "AbortError" ? { esito: "annullato" } : { esito: "errore", nome };
      }
    );
  }
  if (strada.tipo === "scarica") {
    try {
      ambiente.scarica!(strada.file);
      return Promise.resolve({ esito: "salvato", strada: "scarica" });
    } catch (errore) {
      return Promise.resolve({ esito: "errore", nome: nomeErrore(errore) });
    }
  }
  return Promise.resolve({ esito: "impossibile", motivo: strada.motivo });
}

// --- Il browser vero ----------------------------------------------------------

export function appInstallata(): boolean {
  try {
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    return false;
  }
}

// Il download con un link temporaneo. L'indirizzo del file si libera dopo
// un minuto, non subito: alcuni browser leggono il file solo dopo il clic.
function scaricaConLink(file: File): void {
  const indirizzo = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = indirizzo;
  link.download = file.name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(indirizzo), 60_000);
}

export function ambienteBrowser(): AmbienteSalvataggio {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  return {
    canShare: nav?.canShare ? (dati) => nav.canShare(dati) : undefined,
    share: nav?.share ? (dati) => nav.share(dati) : undefined,
    installata: appInstallata(),
    scarica: typeof document === "undefined" ? undefined : scaricaConLink,
  };
}
