// Intestazione di Impostazioni > Profilo (PUNTO_DI_PARTENZA.md, sezione 3):
// iniziali in un cerchio, nome, sotto in grigio "78,4 kg · 180 cm" — ultima
// pesata e altezza SALVATE, non quelle che si stanno scrivendo nel modulo —
// e l'email dell'account, in sola lettura.
//
// Il titolo della pagina ("Profilo") lo dà IntestazioneSottopagina, sopra:
// qui il nome è un sottotitolo. Viene dai metadati dell'account
// (useNomeUtente): se manca, niente iniziali e niente nome. Le iniziali sono
// le stesse della scheda dell'account nell'elenco (SchedaAccount). Se non c'è
// niente da mostrare, l'intestazione non compare.
//
// Con la foto profilo (branch foto-profilo) il cerchio la mostra al posto
// delle iniziali (`foto`: l'indirizzo locale di useMiaFoto), anche senza
// nome; senza foto, le iniziali come prima (CerchioFoto).
//
// Con `azioneFoto` (dal commit 8, CambioFotoProfilo) il cerchio è un
// pulsante con una piccola matita (mockup docs/mockups/foto-profilo.html,
// "Il tocco sulla foto"), e c'è anche senza nome e senza foto: è da qui
// che si aggiunge. `anteprima`: la foto nuova, mostrata sbiadita al posto
// di quella di adesso mentre si carica; allora sotto il nome, al posto di
// peso e altezza, "Caricamento della foto…" con la rotellina.

import type { Ref } from "react";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { TESTO_CARICAMENTO_FOTO } from "@/lib/foto/testiFoto";
import { iniziali } from "./SchedaAccount";
import CerchioFoto from "./CerchioFoto";

function formattaNumero(n: number): string {
  return n.toLocaleString("it-IT", { maximumFractionDigits: 1 });
}

const CLASSE_CERCHIO = "size-14 bg-accent-strong text-xl font-display font-bold text-on-strong";

export default function IntestazioneProfilo({
  nome,
  pesoKg,
  altezzaCm,
  email,
  foto,
  azioneFoto,
  rifPulsanteFoto,
  anteprima = null,
}: {
  nome: string | null;
  pesoKg: number | null;
  altezzaCm: number | null;
  email: string | null;
  foto: string | null;
  azioneFoto?: {
    etichetta: string;
    spenta: boolean;
    onTocca: () => void;
  };
  // Il pulsante del cerchio, per riportarci il fuoco quando si chiude un
  // foglio. A parte e non dentro azioneFoto: un ref dentro un oggetto rende
  // "ref" tutto l'oggetto per il React Compiler.
  rifPulsanteFoto?: Ref<HTMLButtonElement>;
  anteprima?: string | null;
}) {
  const dettagli = [
    pesoKg != null ? `${formattaNumero(pesoKg)} kg` : null,
    altezzaCm != null ? `${formattaNumero(altezzaCm)} cm` : null,
  ].filter((parte) => parte !== null);

  if (!nome && !foto && !azioneFoto && dettagli.length === 0 && !email) return null;

  const cerchio = (
    <CerchioFoto
      indirizzo={anteprima ?? foto}
      iniziali={nome ? iniziali(nome) : null}
      classe={`${CLASSE_CERCHIO} ${anteprima ? "opacity-55" : ""}`}
    />
  );

  return (
    <section className="flex w-full max-w-sm items-center gap-4">
      {azioneFoto ? (
        <button
          ref={rifPulsanteFoto}
          type="button"
          aria-label={azioneFoto.etichetta}
          disabled={azioneFoto.spenta}
          onClick={azioneFoto.onTocca}
          className={`relative shrink-0 rounded-full ${CLASSE_FOCUS}`}
        >
          {cerchio}
          <span
            aria-hidden
            className="absolute -right-0.5 -bottom-0.5 flex size-[22px] items-center justify-center rounded-full border border-border bg-surface text-foreground"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 20h4L19 9l-4-4L4 16z" />
            </svg>
          </span>
        </button>
      ) : (
        (nome || foto) && cerchio
      )}
      <div className="min-w-0">
        {nome && <h2 className="truncate text-2xl font-display font-bold">{nome}</h2>}
        {anteprima ? (
          <p role="status" className="flex items-center gap-2.5 text-sm text-muted">
            <span
              aria-hidden
              className="size-[18px] shrink-0 animate-spin rounded-full border-2 border-border border-t-accent motion-reduce:animate-none"
            />
            {TESTO_CARICAMENTO_FOTO}
          </p>
        ) : (
          dettagli.length > 0 && <p className="text-sm text-muted">{dettagli.join(" · ")}</p>
        )}
        {email && (
          <p className="truncate text-sm text-muted">
            <span className="sr-only">Email: </span>
            {email}
          </p>
        )}
      </div>
    </section>
  );
}
