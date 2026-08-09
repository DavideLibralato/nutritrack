"use client";

import { useTransition } from "react";
import { eliminaPasto } from "@/lib/actions/pasti";

export default function EliminaPastoButton({ id }: { id: string }) {
  const [inCorso, startTransition] = useTransition();

  function handleClick() {
    const conferma = confirm("Eliminare questo pasto?");
    if (!conferma) return;

    startTransition(async () => {
      await eliminaPasto(id);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={inCorso}
      className="text-red-600 text-xs underline ml-3 disabled:opacity-50"
    >
      {inCorso ? "..." : "Elimina"}
    </button>
  );
}