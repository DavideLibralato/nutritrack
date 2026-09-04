"use server";

import { createClient } from "@/lib/supabase/server";
import { traduciErroreAuth } from "@/lib/erroriAuth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function aggiornaObiettivi(datiForm: {
  obiettivoKcal: number;
  obiettivoProteine: number;
  obiettivoCarboidrati: number;
  obiettivoGrassi: number;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { errore: "Utente non autenticato" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      obiettivo_kcal: datiForm.obiettivoKcal,
      obiettivo_proteine: datiForm.obiettivoProteine,
      obiettivo_carboidrati: datiForm.obiettivoCarboidrati,
      obiettivo_grassi: datiForm.obiettivoGrassi,
    })
    .eq("id", user.id);

  if (error) {
    return { errore: error.message };
  }

  // Aggiorna anche la dashboard, che mostra questi stessi valori come
  // obiettivo giornaliero.
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profilo");
  return { successo: true };
}

export async function cambiaPassword(nuovaPassword: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { errore: "Utente non autenticato" };
  }

  const { error } = await supabase.auth.updateUser({
    password: nuovaPassword,
  });

  if (error) {
    return { errore: traduciErroreAuth(error.message) };
  }

  return { successo: true };
}

export async function esci() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // redirect() lancia internamente un'eccezione speciale che Next.js
  // intercetta per fare il redirect: e' normale/atteso, non un errore vero.
  redirect("/login");
}
