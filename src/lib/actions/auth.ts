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
// statoOnboarding.ts è logica pura, senza browser né Dexie: si può usare
// anche qui, sul server.
import { CHIAVE_METADATI_ONBOARDING, type SegnoMetadati } from "@/lib/onboarding/statoOnboarding";

// Il segno con cui nasce ogni account nuovo (PUNTO_DI_PARTENZA.md, sezione
// 3, "Onboarding"): l'onboarding è da fare.
const SEGNO_ALLA_REGISTRAZIONE: SegnoMetadati = "da_fare";

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
  // Il campo si chiama "nomeUtente", non "username": vedi il commento sul
  // campo in src/app/register/page.tsx (iPhone e le password salvate).
  const username = normalizzaUsername(formData.get("nomeUtente")?.toString() ?? "");
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

  // Tutto in raw_user_meta_data. `username` e `codice_invito` servono ai
  // trigger su auth.users, attivi dal 16/10 (PUNTO_DI_PARTENZA.md §9.1):
  // `controlla_registrazione` rifiuta la registrazione se il codice non è
  // quello del Vault o lo username non è valido, toglie `codice_invito` dai
  // metadati e ci riscrive lo username normalizzato; poi
  // `crea_nome_utente_registrazione` crea la riga di `nomi_utente`. Gli
  // altri campi li lasciano passare così come sono: `nome` e il segno
  // dell'onboarding (`onboarding: "da_fare"`, dal 17/10), verificato
  // leggendo la funzione del trigger, che toglie una sola chiave e ne
  // riscrive una sola.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nome,
        username,
        codice_invito: codiceInvito,
        [CHIAVE_METADATI_ONBOARDING]: SEGNO_ALLA_REGISTRAZIONE,
      },
    },
  });

  if (error) {
    return { errore: traduciErroreAuth(error.message), messaggio: null, valori };
  }

  // Se il progetto Supabase ha la conferma email attiva (oggi è spenta,
  // §9.1), qui c'è un utente ma non ancora una sessione: non possiamo
  // mandarlo dentro, deve prima aprire il link che gli arriva via email.
  // Lo username l'ha già creato il trigger: con un nome preso, signUp
  // sarebbe fallito qui sopra ("username già in uso"). Il segno
  // dell'onboarding resta nei metadati: al primo accesso la guardia nel
  // client lo legge e porta all'onboarding.
  if (!data.session) {
    return {
      errore: null,
      messaggio: "Account creato: controlla la tua email per confermarlo prima di accedere.",
      valori,
    };
  }

  // Con la sessione si conferma lo username con imposta_username. La riga di
  // nomi_utente l'ha già creata il trigger con lo stesso nome, e allora la
  // funzione non riscrive niente e risponde "ok" (on conflict ... where
  // is distinct from); resta come rete di sicurezza, nel caso il trigger
  // un giorno non ci fosse. Qualunque esito si entra lo stesso: l'account
  // esiste già e non si annulla per lo username. Se mancasse, lo chiede
  // Amici alla prima apertura (PUNTO_DI_PARTENZA.md §3).
  await impostaUsername(supabase, username);

  // Dentro, si parte dall'onboarding (dal 17/10; prima si andava a Oggi).
  redirect("/onboarding");
}
