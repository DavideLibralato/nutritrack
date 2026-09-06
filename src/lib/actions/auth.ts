"use server";

// Server Action: una funzione che "use server" rende eseguibile solo sul
// server anche se il form che la chiama sta in un componente client. Il
// browser non riceve mai il codice qui dentro (né CODICE_INVITO, che è un
// segreto lato server, non una variabile NEXT_PUBLIC_): riceve solo il
// risultato.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { traduciErroreAuth } from "@/lib/erroriAuth";
import { emailValida } from "@/lib/validazione";

export interface StatoRegistrazione {
  errore: string | null;
  messaggio: string | null;
  // Nome ed email inseriti nell'ultimo tentativo, per ripopolare il form
  // dopo un errore senza dover far riscrivere tutto da capo. La password
  // non torna mai indietro, nemmeno in caso di errore.
  valori: { nome: string; email: string };
}

export async function registrati(
  _statoPrecedente: StatoRegistrazione,
  formData: FormData
): Promise<StatoRegistrazione> {
  const nome = formData.get("nome")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const codiceInvito = formData.get("codiceInvito")?.toString().trim() ?? "";

  const valori = { nome, email };

  // Il form ha noValidate: questi controlli sostituiscono i messaggi nativi
  // del browser (spesso in inglese) con messaggi in italiano.
  if (!nome || !email || !password || !codiceInvito) {
    return { errore: "Compila tutti i campi.", messaggio: null, valori };
  }
  if (!emailValida(email)) {
    return { errore: "Inserisci un indirizzo email valido.", messaggio: null, valori };
  }
  if (password.length < 6) {
    return { errore: "La password deve avere almeno 6 caratteri.", messaggio: null, valori };
  }

  // Beta a inviti (PUNTO_DI_PARTENZA.md, sezione 9.1): un controllo di una
  // riga, da togliere il giorno in cui l'app si apre a tutti.
  if (!process.env.CODICE_INVITO || codiceInvito !== process.env.CODICE_INVITO) {
    return { errore: "Codice di invito non valido.", messaggio: null, valori };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nome }, // finisce in raw_user_meta_data
    },
  });

  if (error) {
    return { errore: traduciErroreAuth(error.message), messaggio: null, valori };
  }

  // Se il progetto Supabase ha la conferma email attiva, qui c'è un utente
  // ma non ancora una sessione: non possiamo mandarlo dentro, deve prima
  // aprire il link che gli arriva via email.
  if (!data.session) {
    return {
      errore: null,
      messaggio: "Account creato: controlla la tua email per confermarlo prima di accedere.",
      valori,
    };
  }

  redirect("/");
}
