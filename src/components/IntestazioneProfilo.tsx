// Intestazione di Impostazioni > Profilo (PUNTO_DI_PARTENZA.md, sezione 3):
// iniziali in un cerchio, nome, sotto in grigio "78,4 kg · 180 cm" — ultima
// pesata e altezza SALVATE, non quelle che si stanno scrivendo nel modulo —
// e l'email dell'account, in sola lettura.
//
// Il titolo della pagina ("Profilo") lo dà IntestazioneSottopagina, sopra:
// qui il nome è un sottotitolo. Viene dai metadati dell'account
// (useNomeUtente): se manca, niente cerchio e niente nome. Le iniziali sono
// le stesse della scheda dell'account nell'elenco (SchedaAccount). Se non c'è
// niente da mostrare, l'intestazione non compare.

import { iniziali } from "./SchedaAccount";

function formattaNumero(n: number): string {
  return n.toLocaleString("it-IT", { maximumFractionDigits: 1 });
}

export default function IntestazioneProfilo({
  nome,
  pesoKg,
  altezzaCm,
  email,
}: {
  nome: string | null;
  pesoKg: number | null;
  altezzaCm: number | null;
  email: string | null;
}) {
  const dettagli = [
    pesoKg != null ? `${formattaNumero(pesoKg)} kg` : null,
    altezzaCm != null ? `${formattaNumero(altezzaCm)} cm` : null,
  ].filter((parte) => parte !== null);

  if (!nome && dettagli.length === 0 && !email) return null;

  return (
    <section className="flex w-full max-w-sm items-center gap-4">
      {nome && (
        <div
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-strong text-xl font-display font-bold text-on-strong"
        >
          {iniziali(nome)}
        </div>
      )}
      <div className="min-w-0">
        {nome && <h2 className="truncate text-2xl font-display font-bold">{nome}</h2>}
        {dettagli.length > 0 && <p className="text-sm text-muted">{dettagli.join(" · ")}</p>}
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
