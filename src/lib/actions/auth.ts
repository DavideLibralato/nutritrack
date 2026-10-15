"use server";

// Server Action: una funzione che "use server" rende eseguibile solo sul
// server anche se il form che la chiama sta in un componente client. Il
// browser non riceve mai il codice qui dentro (né CODICE_INVITO, che è un
// segreto lato server, non una variabile NEXT_PUBLIC_): riceve solo il
// risultato.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { traduciErroreAuth } from "@/lib/erroriAuth";
import { emailValida, normalizzaUsername, usernameValido } from "@/lib/validazione";
import { controllaDisponibilita, impostaUsername } from "@/lib/amici/nomiUtente";
import { TESTO_USERNAME_IN_USO, TESTO_USERNAME_NON_VALIDO } from "@/lib/amici/testiUsername";

export interface StatoRegistrazione {
  errore: string | null;
  messaggio: string | null;
  // Nome, username ed email inseriti nell'ultimo tentativo, per ripopolare
  // il form dopo un errore senza dover far riscrivere tutto da capo. La
  // password non torna mai indietro, nemmeno in caso di errore.
  valori: { nome: string; username: string; email: string };
}

export async function registrati(
  _statoPrecedente: StatoRegistrazione,
  formData: FormData
): Promise<StatoRegistrazione> {
  const nome = formData.get("nome")?.toString().trim() ?? "";
  const username = normalizzaUsername(formData.get("username")?.toString() ?? "");
  const email = formData.get("email")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const codiceInvito = formData.get("codiceInvito")?.toString().trim() ?? "";

  const valori = { nome, username, email };

  // Il form ha noValidate: questi controlli sostituiscono i messaggi nativi
  // del browser (spesso in inglese) con messaggi in italiano.
  if (!nome || !username || !email || !password || !codiceInvito) {
    return { errore: "Compila tutti i campi.", messaggio: null, valori };
  }
  if (!usernameValido(username)) {
    return { errore: TESTO_USERNAME_NON_VALIDO, messaggio: null, valori };
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

  // Lo username è libero? Si chiede dopo il codice di invito, così da
  // questo modulo il controllo lo fa solo chi è invitato. Se la risposta
  // non arriva si va avanti: il nome lo protegge comunque l'indice unico
  // del database, al salvataggio qui sotto.
  if ((await controllaDisponibilita(supabase, username)) === "in_uso") {
    return { errore: TESTO_USERNAME_IN_USO, messaggio: null, valori };
  }

  // Tutto in raw_user_meta_data. `username` e `codice_invito` servono al
  // trigger su auth.users (PUNTO_DI_PARTENZA.md §9.1), che arriva dopo il
  // merge di `amici` e da lì in poi controlla il codice, toglie
  // `codice_invito` dai metadati e crea la riga di `nomi_utente`. Finché
  // il trigger non c'è, i due campi restano lì senza effetto (la migration
  // del trigger toglie `codice_invito` anche dalle righe di chi si è
  // registrato prima).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nome, username, codice_invito: codiceInvito },
    },
  });

  if (error) {
    return { errore: traduciErroreAuth(error.message), messaggio: null, valori };
  }

  // Se il progetto Supabase ha la conferma email attiva, qui c'è un utente
  // ma non ancora una sessione: non possiamo mandarlo dentro, deve prima
  // aprire il link che gli arriva via email. Lo username non si può
  // salvare ora (imposta_username vuole un utente entrato): lo chiede
  // Amici alla prima apertura (PUNTO_DI_PARTENZA.md §3).
  if (!data.session) {
    return {
      errore: null,
      messaggio: "Account creato: controlla la tua email per confermarlo prima di accedere.",
      valori,
    };
  }

  // Con la sessione lo username si salva subito, finché il trigger non lo
  // fa da solo. Qualunque esito si entra lo stesso: l'account esiste già e
  // non si annulla per lo username. Se il nome è stato preso nel frattempo
  // ("occupato") o la risposta non arriva, lo username resta da scegliere
  // e lo chiede Amici alla prima apertura, come per chi è registrato da
  // prima.
  await impostaUsername(supabase, username);

  redirect("/");
}
