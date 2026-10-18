// Impostazioni > Profilo > Cambia password (mockup
// docs/mockups/cambia-password.html). Ci si arriva dalla riga "Password"
// in fondo al gruppo Account di Profilo, e "‹ Profilo" riporta lì. Come
// Elimina account, la pagina è un componente server con dentro il
// componente client CambiaPassword, che ha gli stati e fa il lavoro.

import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import CambiaPassword from "@/components/CambiaPassword";

export default function CambiaPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+1.5rem)]">
      <IntestazioneSottopagina
        titolo="Cambia password"
        indietro={{ href: "/impostazioni/profilo", etichetta: "Profilo" }}
      />
      <CambiaPassword />
    </main>
  );
}
