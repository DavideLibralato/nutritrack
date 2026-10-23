"use server";

// Server Action: una funzione che "use server" rende eseguibile solo sul
// server anche se il form che la chiama sta in un componente client. Il
// browser non riceve mai il codice qui dentro (né CODICE_INVITO, che è un
// segreto lato server, non una variabile NEXT_PUBLIC_): riceve solo il
// risultato.

import { createClient } from "@/lib/supabase/server";
import { traduciErroreAuth } from "@/lib/erroriAuth";
import { emailValida } from "@/lib/validazione";
// statoOnboarding.ts è logica pura, senza browser né Dexie: si può usare
// anche qui, sul server.
import { CHIAVE_METADATI_ONBOARDING, type SegnoMetadati } from "@/lib/onboarding/statoOnboarding";

// Il segno con cui nasce ogni account nuovo (PUNTO_DI_PARTENZA.md, sezione
// 3, "Onboarding"): l'onboarding è da fare.
const SEGNO_ALLA_REGISTRAZIONE: SegnoMetadati = "da_fare";

export interface StatoRegistrazione {
  errore: string | null;
  messaggio: string | null;
  // Registrato e con la sessione: la pagina Registrati fa un caricamento
  // completo di /onboarding (src/lib/caricamentoCompleto.ts). Non un
  // redirect da qui: vedi la fine di registrati().
  registrato?: true;
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

  // Tutto in raw_user_meta_data. `codice_invito` serve al trigger su
  // auth.users `controlla_registrazione` (PUNTO_DI_PARTENZA.md §9.1): rifiuta
  // la registrazione se il codice non è quello del Vault e lo toglie dai
  // metadati. Gli altri campi passano così come sono: `nome` e il segno
  // dell'onboarding (`onboarding: "da_fare"`, dal 17/10).
  //
  // Niente `username` (dal branch username-dopo-accesso, PUNTO §3, "Lo
  // username dopo l'accesso"): lo si sceglie nell'onboarding, dopo
  // l'accesso. Dalla migration registrazione_username_facoltativo (23/10) i
  // trigger lasciano nascere l'account senza, e nessuna riga va in
  // nomi_utente.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nome,
        codice_invito: codiceInvito,
        [CHIAVE_METADATI_ONBOARDING]: SEGNO_ALLA_REGISTRAZIONE,
      },
    },
  });

  if (error) {
    // Anche un rifiuto del trigger arriva qui, come errore generico del
    // database ("Database error saving new user"): con lo username
    // facoltativo resta un solo caso, il codice di invito che non è più
    // quello del Vault (i due valori vanno cambiati insieme, §9.1). Il
    // motivo vero si legge nei log; all'app resta il messaggio generico.
    return { errore: traduciErroreAuth(error.message), messaggio: null, valori };
  }

  // Se il progetto Supabase ha la conferma email attiva (oggi è spenta,
  // §9.1), qui c'è un utente ma non ancora una sessione: non possiamo
  // mandarlo dentro, deve prima aprire il link che gli arriva via email. Il
  // segno dell'onboarding resta nei metadati: al primo accesso la guardia
  // nel client lo legge e porta all'onboarding, dove si sceglie anche lo
  // username.
  if (!data.session) {
    return {
      errore: null,
      messaggio: "Account creato: controlla la tua email per confermarlo prima di accedere.",
      valori,
    };
  }

  // Dentro, si parte dall'onboarding (dal 17/10; prima si andava a Oggi).
  // Non con redirect(): sarebbe una navigazione interna di Next.js, e i
  // componenti del layout radice, montati su /register senza sessione,
  // resterebbero senza utente, perché la sessione nata qui sul server non
  // manda nessun evento al client del browser. Senza utente la
  // sincronizzazione non parte, la discesa non riesce mai e /onboarding
  // resta su "Caricamento..." (trovato nelle prove su iPhone del 17/10).
  // Si risponde "registrato", e la pagina fa un caricamento completo.
  return { errore: null, messaggio: null, valori, registrato: true };
}
