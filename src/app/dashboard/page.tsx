import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import EliminaPastoButton from "@/components/EliminaPastoButton";

const CLASSE_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

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
        <h1 className="text-xl font-display font-semibold">Oggi</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/statistiche" className={`border border-border rounded-lg px-4 py-2 text-sm ${CLASSE_FOCUS}`}>
            Statistiche
          </Link>
          <Link href="/dashboard/storico" className={`border border-border rounded-lg px-4 py-2 text-sm ${CLASSE_FOCUS}`}>
            Storico
          </Link>
          <Link href="/dashboard/nuovo" className={`bg-foreground text-background rounded-lg px-4 py-2 text-sm ${CLASSE_FOCUS}`}>
            + Aggiungi pasto
          </Link>
          <Link href="/dashboard/profilo" className={`border border-border rounded-lg px-4 py-2 text-sm ${CLASSE_FOCUS}`}>
            Profilo
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
        <h2 className="font-display font-medium mb-2">Pasti di oggi</h2>
        {(!pastiOggi || pastiOggi.length === 0) && (
          <p className="text-muted text-sm">Nessun pasto registrato oggi.</p>
        )}
        <ul className="flex flex-col gap-2">
          {pastiOggi?.map((p) => (
            <li key={p.id} className="border border-border rounded-xl px-3 py-2 flex justify-between items-center text-sm">
              <span>{p.nome_visualizzato} ({p.grammi}g)</span>
              <span className="flex items-center gap-1">
                <span className="mr-1 font-display tabular-nums">{p.kcal} kcal</span>
                <Link href={`/dashboard/modifica/${p.id}`} className={`text-xs underline px-2 py-1 rounded ${CLASSE_FOCUS}`}>
                  Modifica
                </Link>
                <EliminaPastoButton id={p.id} nome={p.nome_visualizzato} />
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
  const sforato = valore > obiettivo;
  const percentuale = Math.min(100, Math.round((valore / obiettivo) * 100));
  return (
    <div className="border border-border rounded-xl p-3">
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: sforato ? "var(--enfasi)" : "var(--foreground)" }}
        />
        {etichetta}
      </p>
      <p className={`font-display tabular-nums text-lg font-semibold mt-1 ${sforato ? "text-accent" : ""}`}>
        {Math.round(valore)}{unita} / {obiettivo}{unita}
        {sforato && (
          <span className="text-xs font-normal ml-1">
            (+{Math.round(valore - obiettivo)}{unita})
          </span>
        )}
      </p>
      <div className="w-full bg-border rounded-full h-1.5 mt-2">
        <div
          className={`h-1.5 rounded-full ${sforato ? "bg-accent" : "bg-foreground"}`}
          style={{ width: `${percentuale}%` }}
        />
      </div>
    </div>
  );
}
