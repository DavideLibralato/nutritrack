import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import GraficoAndamentoKcal from "@/components/GraficoAndamentoKcal";
import GraficoMacro from "@/components/GraficoMacro";

type RangeKey = "7" | "sempre";

type DatoGiorno = {
  data: string;
  etichetta: string;
  kcal: number;
  proteine: number;
  carboidrati: number;
  grassi: number;
};

export default async function StatistichePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range: RangeKey = rangeParam === "sempre" ? "sempre" : "7";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <p>Devi effettuare il login.</p>;
  }

  const { data: profilo } = await supabase
    .from("profiles")
    .select("obiettivo_kcal")
    .eq("id", user.id)
    .single();

  let query = supabase
    .from("pasti")
    .select("kcal, proteine, carboidrati, grassi, consumato_at")
    .eq("user_id", user.id)
    .order("consumato_at", { ascending: true });

  if (range === "7") {
    const settGiorniFa = new Date();
    settGiorniFa.setDate(settGiorniFa.getDate() - 6);
    settGiorniFa.setHours(0, 0, 0, 0);
    query = query.gte("consumato_at", settGiorniFa.toISOString());
  }

  const { data: pasti } = await query;

  // Raggruppa i pasti per giorno (somma kcal/macro di tutti i pasti dello stesso giorno)
  const perGiorno = new Map<
    string,
    { kcal: number; proteine: number; carboidrati: number; grassi: number }
  >();
  (pasti ?? []).forEach((p) => {
    const chiave = new Date(p.consumato_at).toISOString().slice(0, 10); // "YYYY-MM-DD"
    const attuale = perGiorno.get(chiave) ?? {
      kcal: 0,
      proteine: 0,
      carboidrati: 0,
      grassi: 0,
    };
    perGiorno.set(chiave, {
      kcal: attuale.kcal + p.kcal,
      proteine: attuale.proteine + p.proteine,
      carboidrati: attuale.carboidrati + p.carboidrati,
      grassi: attuale.grassi + p.grassi,
    });
  });

  // Costruisce la lista di giorni da mostrare nel grafico.
  // Per "ultimi 7 giorni" includiamo anche i giorni senza pasti (a 0), cosi il grafico e continuo.
  // Per "sempre" mostriamo solo i giorni in cui e stato registrato almeno un pasto.
  let chiaviGiorni: string[];
  if (range === "7") {
    chiaviGiorni = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      chiaviGiorni.push(d.toISOString().slice(0, 10));
    }
  } else {
    chiaviGiorni = Array.from(perGiorno.keys()).sort();
  }

  const datiGiornalieri: DatoGiorno[] = chiaviGiorni.map((chiave) => {
    const dati = perGiorno.get(chiave) ?? {
      kcal: 0,
      proteine: 0,
      carboidrati: 0,
      grassi: 0,
    };
    const [, mese, giorno] = chiave.split("-");
    return {
      data: chiave,
      etichetta: `${giorno}/${mese}`,
      ...dati,
    };
  });

  const giorniConDati = datiGiornalieri.filter(
    (g) => g.kcal > 0 || g.proteine > 0 || g.carboidrati > 0 || g.grassi > 0
  );
  const numGiorni = giorniConDati.length || 1;
  const medie = giorniConDati.reduce(
    (acc, g) => ({
      kcal: acc.kcal + g.kcal,
      proteine: acc.proteine + g.proteine,
      carboidrati: acc.carboidrati + g.carboidrati,
      grassi: acc.grassi + g.grassi,
    }),
    { kcal: 0, proteine: 0, carboidrati: 0, grassi: 0 }
  );
  medie.kcal /= numGiorni;
  medie.proteine /= numGiorni;
  medie.carboidrati /= numGiorni;
  medie.grassi /= numGiorni;

  return (
    <main className="p-6 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Statistiche</h1>
        <Link href="/dashboard" className="text-sm underline">
          ← Torna a oggi
        </Link>
      </div>

      <div className="flex gap-2">
        <Link
          href="/dashboard/statistiche?range=7"
          className={`rounded px-4 py-2 text-sm ${
            range === "7" ? "bg-black text-white" : "border"
          }`}
        >
          Ultimi 7 giorni
        </Link>
        <Link
          href="/dashboard/statistiche?range=sempre"
          className={`rounded px-4 py-2 text-sm ${
            range === "sempre" ? "bg-black text-white" : "border"
          }`}
        >
          Sempre
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <CardMedia etichetta="Kcal medie/giorno" valore={medie.kcal} />
        <CardMedia
          etichetta="Proteine medie/giorno"
          valore={medie.proteine}
          unita="g"
        />
        <CardMedia
          etichetta="Carboidrati medi/giorno"
          valore={medie.carboidrati}
          unita="g"
        />
        <CardMedia
          etichetta="Grassi medi/giorno"
          valore={medie.grassi}
          unita="g"
        />
      </section>

      {giorniConDati.length === 0 ? (
        <p className="text-gray-500 text-sm">
          Nessun dato disponibile per questo periodo.
        </p>
      ) : (
        <>
          <section>
            <h2 className="font-medium mb-2">Andamento kcal</h2>
            <GraficoAndamentoKcal
              dati={datiGiornalieri}
              obiettivoKcal={profilo?.obiettivo_kcal ?? 2000}
            />
          </section>

          <section>
            <h2 className="font-medium mb-2">Composizione macro per giorno</h2>
            <GraficoMacro dati={datiGiornalieri} />
          </section>
        </>
      )}
    </main>
  );
}

function CardMedia({
  etichetta,
  valore,
  unita = "",
}: {
  etichetta: string;
  valore: number;
  unita?: string;
}) {
  return (
    <div className="border rounded p-3">
      <p className="text-sm text-gray-500">{etichetta}</p>
      <p className="text-lg font-semibold">
        {Math.round(valore)}
        {unita}
      </p>
    </div>
  );
}
