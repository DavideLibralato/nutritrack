// La scelta del tema in Impostazioni > Aspetto (mockup
// docs/mockups/impostazioni.html, "5 · Aspetto"): tre anteprime affiancate,
// Chiaro / Scuro / Sistema, ciascuna con il nome e un pallino di scelta
// sotto. Quella scelta ha il contorno d'accento e il pallino pieno con ✓.
//
// Le anteprime non hanno colori propri: sono piccoli pezzi di pagina con
// data-tema="chiaro" o "scuro", e globals.css ricalcola lì dentro tutti i
// token per quel tema. Così mostrano i colori veri dell'app, e restano
// giuste se la palette cambia. "Sistema" è metà chiara e metà scura.
//
// Sono veri <input type="radio"> (nascosti alla vista, non allo screen
// reader) dentro le loro etichette: tutta l'anteprima è toccabile, e da
// tastiera le frecce passano da una scelta all'altra come in ogni gruppo di
// radio.

import type { SceltaTema } from "@/lib/tema";

const SCELTE: { valore: SceltaTema; etichetta: string }[] = [
  { valore: "chiaro", etichetta: "Chiaro" },
  { valore: "scuro", etichetta: "Scuro" },
  { valore: "sistema", etichetta: "Sistema" },
];

export default function SelettoreTema({
  scelta,
  onCambia,
}: {
  // null: scelta non ancora letta (prima che il browser legga
  // localStorage), nessuna anteprima segnata.
  scelta: SceltaTema | null;
  onCambia: (scelta: SceltaTema) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Tema" className="flex gap-2.5 px-3 pt-4 pb-3.5">
      {SCELTE.map((s) => {
        const attiva = s.valore === scelta;
        return (
          <label
            key={s.valore}
            className="flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-2"
          >
            <input
              type="radio"
              name="tema"
              value={s.valore}
              checked={attiva}
              onChange={() => onCambia(s.valore)}
              className="peer sr-only"
            />
            {/* Il contorno della scelta sta fuori dalla miniatura: dentro,
                con data-tema, l'accento sarebbe quello del tema mostrato. */}
            <span
              aria-hidden
              className={`block w-full rounded-[14px] ${
                attiva ? "outline-[2.5px] outline-offset-2 outline-accent outline-solid" : ""
              }`}
            >
              {s.valore === "sistema" ? (
                <span className="flex h-[118px] overflow-hidden rounded-[14px] border border-border">
                  <MetaAnteprima tema="chiaro" />
                  <MetaAnteprima tema="scuro" />
                </span>
              ) : (
                <Anteprima tema={s.valore} />
              )}
            </span>
            <span className="text-sm">{s.etichetta}</span>
            <span
              aria-hidden
              className={`flex size-[22px] items-center justify-center rounded-full border-[1.5px] text-[13px] leading-none peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface ${
                attiva ? "border-accent-strong bg-accent-strong text-on-strong" : "border-border"
              }`}
            >
              {attiva && "✓"}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// Una pagina in miniatura: titolo, anello delle calorie con due righe
// accanto, una scheda in basso.
function Anteprima({ tema }: { tema: "chiaro" | "scuro" }) {
  return (
    <span
      data-tema={tema}
      className="block h-[118px] rounded-[14px] border border-border bg-background p-2.5"
    >
      <span className="block h-1.5 w-[46%] rounded-full bg-foreground opacity-85" />
      <span className="mt-2 flex items-center gap-1.5">
        <span className="size-[22px] shrink-0 rounded-full border-4 border-accent" />
        <span className="flex-1">
          <span className="my-[3px] block h-1 rounded-full bg-border" />
          <span className="my-[3px] block h-1 rounded-full bg-border" />
        </span>
      </span>
      <span className="mt-2.5 block h-3 rounded-md border border-border bg-surface" />
    </span>
  );
}

// Mezza miniatura per "Sistema": a sinistra il chiaro con titolo e anello,
// a destra lo scuro con titolo e righe.
function MetaAnteprima({ tema }: { tema: "chiaro" | "scuro" }) {
  return (
    <span
      data-tema={tema}
      className={`block flex-1 bg-background pt-2.5 ${tema === "chiaro" ? "pl-2.5" : "pr-2.5"}`}
    >
      {tema === "chiaro" ? (
        <>
          <span className="block h-1.5 w-[70%] rounded-full bg-foreground" />
          <span className="mt-2 block size-[22px] rounded-full border-4 border-accent" />
        </>
      ) : (
        <>
          <span className="block h-1.5 w-[40%] rounded-full bg-foreground" />
          <span className="mt-3.5 block h-1 rounded-full bg-border" />
          <span className="mt-[5px] block h-1 rounded-full bg-border" />
        </>
      )}
    </span>
  );
}
