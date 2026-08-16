"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function aggiungiPastoManuale(
  datiForm: {
    nome: string;
    grammi: number;
    kcal: number;
    proteine: number;
    carboidrati: number;
    grassi: number;
  },
  metodo: "manuale" | "etichetta" | "barcode" | "foto_ai" | "testo_ai" = "manuale"
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { errore: "Utente non autenticato" };
  }

  const { error } = await supabase.from("pasti").insert({
    user_id: user.id,
    alimento_id: null,
    nome_visualizzato: datiForm.nome,
    grammi: datiForm.grammi,
    kcal: datiForm.kcal,
    proteine: datiForm.proteine,
    carboidrati: datiForm.carboidrati,
    grassi: datiForm.grassi,
    metodo: metodo,
  });

  if (error) {
    return { errore: error.message };
  }

  revalidatePath("/dashboard");
  return { successo: true };
}

export async function eliminaPasto(id: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { errore: "Utente non autenticato" };
  }

  const { error } = await supabase
    .from("pasti")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // doppia sicurezza: elimina solo se è tuo

  if (error) {
    return { errore: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/storico");
  return { successo: true };
}

export async function modificaPasto(
  id: string,
  datiForm: {
    nome: string;
    grammi: number;
    kcal: number;
    proteine: number;
    carboidrati: number;
    grassi: number;
  }
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { errore: "Utente non autenticato" };
  }

  const { error } = await supabase
    .from("pasti")
    .update({
      nome_visualizzato: datiForm.nome,
      grammi: datiForm.grammi,
      kcal: datiForm.kcal,
      proteine: datiForm.proteine,
      carboidrati: datiForm.carboidrati,
      grassi: datiForm.grassi,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { errore: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/storico");
  return { successo: true };
}

export async function getPasto(id: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("pasti")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  return data;
}