import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Pagina radice ("/"): e quella che si apre quando l'utente lancia
// l'app dalla home screen dell'iPhone. Non mostriamo nulla qui:
// mandiamo subito l'utente alla dashboard se ha gia fatto login,
// altrimenti alla pagina di accesso.
export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
