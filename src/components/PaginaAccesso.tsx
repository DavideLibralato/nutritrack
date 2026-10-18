// Il contenitore delle pagine di accesso (Accedi, Registrati, Password
// dimenticata, Reimposta password, con tutte le loro schermate): il
// contenuto centrato in verticale, largo al massimo 24rem (max-w-sm),
// come nel mockup docs/mockups/testata-login.html.
//
// marchioInCima: il marchio piccolo di Libra fisso in alto, fuori dal
// blocco centrato, per le pagine che non hanno "Libra" nel titolo. Sta
// sempre nello stesso punto: passando da "Verifica del link in corso..."
// al modulo o a "Link non valido" non si muove. Allineato a sinistra con
// il modulo, anche su uno schermo largo.
//
// Su uno schermo basso (tastiera aperta) la pagina scorre: min-h-screen,
// non un'altezza fissa.

import MarchioLibra from "./MarchioLibra";

export default function PaginaAccesso({
  marchioInCima = false,
  children,
}: {
  marchioInCima?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      {marchioInCima && (
        <div className="flex h-11 w-full max-w-sm shrink-0 items-center text-lg">
          <MarchioLibra variante="piccolo" />
        </div>
      )}
      <div className="my-auto flex w-full justify-center py-4">{children}</div>
    </main>
  );
}
