import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import EliminaPastoButton from "@/components/EliminaPastoButton";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <p>Devi effettuare il login.</p>;
  }

  const { data: profilo } = await supabase
    .from("profiles")
    .select("obiettivo_kcal, obiettivo_proteine, obiettivo_carboidrati, obiettivo_grassi")
    .eq("id", user.id)
    .single();

  const oggiInizio = new Date();
  oggiInizio.setHours(0, 0, 0, 0);

  const { data: pastiOggi } = await supabase
    .from("pasti")
    .select("*")
    .eq("user_id", user.id)
    .gte("consumato_at", oggiInizio.toISOString())
    .order("consumato_at", { ascending: false });

  const totali = (pastiOggi ?? []).reduce(
    (acc, p) => ({
      kcal: acc.kcal + p.kcal,
      proteine: acc.proteine + p.proteine,
      carboidrati: acc.carboidrati + p.carboidrati,
      grassi: acc.grassi + p.grassi,
    }),
    { kcal: 0, proteine: 0, carboidrati: 0, grassi: 0 }
  );

  return (
    <main className="p-6 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Oggi</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/statistiche" className="border rounded px-4 py-2 text-sm">
            Statistiche
          </Link>
          <Link href="/dashboard/storico" className="border rounded px-4 py-2 text-sm">
            Storico
          </Link>
          <Link href="/dashboard/nuovo" className="bg-black text-white rounded px-4 py-2 text-sm">
            + Aggiungi pasto
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <RiepilogoCard etichetta="Kcal" valore={totali.kcal} obiettivo={profilo?.obiettivo_kcal ?? 2000} />
        <RiepilogoCard etichetta="Proteine" valore={totali.proteine} obiettivo={profilo?.obiettivo_proteine ?? 150} unita="g" />
        <RiepilogoCard etichetta="Carboidrati" valore={totali.carboidrati} obiettivo={profilo?.obiettivo_carboidrati ?? 250} unita="g" />
        <RiepilogoCard etichetta="Grassi" valore={totali.grassi} obiettivo={profilo?.obiettivo_grassi ?? 70} unita="g" />
      </section>

      <section>
        <h2 className="font-medium mb-2">Pasti di oggi</h2>
        {(!pastiOggi || pastiOggi.length === 0) && (
          <p className="text-gray-500 text-sm">Nessun pasto registrato oggi.</p>
        )}
        <ul className="flex flex-col gap-2">
          {pastiOggi?.map((p) => (
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
    </main>
  );
}

function RiepilogoCard({
  etichetta,
  valore,
  obiettivo,
  unita = "",
}: {
  etichetta: string;
  valore: number;
  obiettivo: number;
  unita?: string;
}) {
  const percentuale = Math.min(100, Math.round((valore / obiettivo) * 100));
  return (
    <div className="border rounded p-3">
      <p className="text-sm text-gray-500">{etichetta}</p>
      <p className="text-lg font-semibold">{Math.round(valore)}{unita} / {obiettivo}{unita}</p>
      <div className="w-full bg-gray-200 rounded h-2 mt-1">
        <div className="bg-black h-2 rounded" style={{ width: `${percentuale}%` }} />
      </div>
    </div>
  );
}