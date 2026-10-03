"use client";

// Un Link di Next che passa dal guardiano delle modifiche non salvate
// (GuardianoModifiche): se la pagina ha modifiche, invece di navigare apre
// "Esci senza salvare?". Lo usano "‹ Impostazioni" (IntestazioneSottopagina)
// e le voci della tab bar (BarraNavigazione), compreso il tocco sulla voce
// già attiva, che da una sotto-pagina riporta all'elenco.

import Link from "next/link";
import type { ComponentProps } from "react";
import { useNavigazioneProtetta } from "./GuardianoModifiche";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

export default function LinkProtetto({ href, onClick, ...resto }: Props) {
  const proteggiNavigazione = useNavigazioneProtetta();
  return (
    <Link
      href={href}
      onClick={(evento) => {
        onClick?.(evento);
        proteggiNavigazione(evento, href);
      }}
      {...resto}
    />
  );
}
