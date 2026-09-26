// Intestazione del Profilo (PUNTO_DI_PARTENZA.md, sezione 3): iniziale in un
// cerchio, nome, e sotto in grigio "78,4 kg · 180 cm" — ultima pesata e
// altezza SALVATE, non quelle che si stanno scrivendo nel modulo.
//
// Il nome viene dai metadati dell'account (useNomeUtente): se manca, niente
// cerchio e niente nome, e come titolo resta "Profilo". Se mancano anche peso
// e altezza, la riga grigia non compare.

function formattaNumero(n: number): string {
  return n.toLocaleString("it-IT", { maximumFractionDigits: 1 });
}

export default function IntestazioneProfilo({
  nome,
  pesoKg,
  altezzaCm,
}: {
  nome: string | null;
  pesoKg: number | null;
  altezzaCm: number | null;
}) {
  const dettagli = [
    pesoKg != null ? `${formattaNumero(pesoKg)} kg` : null,
    altezzaCm != null ? `${formattaNumero(altezzaCm)} cm` : null,
  ].filter((parte) => parte !== null);

  return (
    <header className="flex w-full max-w-sm items-center gap-4 pt-8">
      {nome && (
        <div
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-2xl font-display font-bold text-accent"
        >
          {nome.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-display font-bold">{nome ?? "Profilo"}</h1>
        {dettagli.length > 0 && <p className="text-sm text-muted">{dettagli.join(" · ")}</p>}
      </div>
    </header>
  );
}
