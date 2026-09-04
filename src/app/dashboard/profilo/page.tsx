import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import FormProfilo from "@/components/FormProfilo";

const CLASSE_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

export default async function ProfiloPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <p>Devi effettuare il login.</p>;
  }

  const { data: profilo } = await supabase
    .from("profiles")
    .select("obiettivo_kcal, obiettivo_proteine, obiettivo_carboidrati, obiettivo_grassi")
    .eq("id", user.id)
    .single();

  return (
    <main className="p-6 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-display font-semibold">Profilo</h1>
        <Link
          href="/dashboard"
          className={`border border-border rounded-lg px-4 py-2 text-sm ${CLASSE_FOCUS}`}
        >
          Torna alla dashboard
        </Link>
      </div>

      <p className="text-sm text-muted">{user.email}</p>

      <FormProfilo
        obiettiviIniziali={{
          obiettivo_kcal: profilo?.obiettivo_kcal ?? 2000,
          obiettivo_proteine: profilo?.obiettivo_proteine ?? 150,
          obiettivo_carboidrati: profilo?.obiettivo_carboidrati ?? 250,
          obiettivo_grassi: profilo?.obiettivo_grassi ?? 70,
        }}
      />
    </main>
  );
}
