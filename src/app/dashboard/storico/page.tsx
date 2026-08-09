import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import EliminaPastoButton from "@/components/EliminaPastoButton";

export default async function StoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ da?: string; a?: string }>;
}) {
  const { da, a } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p>Devi effettuare il login.</p>;
  }

  let query = supabase
    .from("pasti")
    .select("*")
    .eq("user_id", user.id)
    .order("consumato_at", { ascending: false });

  if (da) {
    query = query.gte("consumato_at", `${da}T00:00:00`);
  }
  if (a) {
    query = query.lte("consumato_at", `${a}T23:59:59`);
  }

  const { data: pasti } = await query;

  // Raggruppa i pasti per giorno (es. "09/08/2026")
  const gruppi: Record<string, any[]> = {};
  (pasti ?? []).forEach((p: any) => {
    const chiave = new Date(p.consumato_at).toLocaleDateString("it-IT");
    if (!gruppi[chiave]) gruppi[chiave] = [];
    gruppi[chiave].push(p);
  });

  return (
    <main className="p-6 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Storico pasti</h1>
        <Link href="/dashboard" className="text-sm underline">
          ← Torna a oggi
        </Link>
      </div>

      <form method="get" className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-sm font-medium mb-1">Da</label>
          <input type="date" name="da" defaultValue={da} className="border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">A</label>
          <input type="date" name="a" defaultValue={a} className="border rounded px-3 py-2" />
        </div>
        <button type="submit" className="bg-black text-white rounded px-4 py-2 text-sm">
          Filtra
        </button>
        {(da || a) && (
          <Link href="/dashboard/storico" className="text-sm underline px-2 py-2">
            Rimuovi filtro
          </Link>
        )}
      </form>

      {Object.keys(gruppi).length === 0 && (
        <p className="text-gray-500 text-sm">Nessun pasto trovato per il periodo selezionato.</p>
      )}

      <div className="flex flex-col gap-6">
        {Object.entries(gruppi).map(([giorno, pastiGiorno]) => {
          const kcalGiorno = pastiGiorno.reduce((tot: number, p: any) => tot + p.kcal, 0);
          return (
            <section key={giorno}>
              <h2 className="font-medium mb-2">
                {giorno}{" "}
                <span className="text-gray-500 text-sm">
                  — {Math.round(kcalGiorno)} kcal totali
                </span>
              </h2>
              <ul className="flex flex-col gap-2">
                {pastiGiorno.map((p: any) => (
                  <li key={p.id} className="border rounded px-3 py-2 flex justify-between items-center text-sm">
                    <span>{p.nome_visualizzato} ({p.grammi}g)</span>
                    <span className="flex items-center">
                      {p.kcal} kcal
                      <Link href={`/dashboard/modifica/${p.id}`} className="text-xs underline ml-3">
                        Modifica
                      </Link>
                      <EliminaPastoButton id={p.id} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}