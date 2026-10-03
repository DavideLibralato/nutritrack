import type { NextConfig } from "next";
import pacchetto from "./package.json";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Versione e commit per Impostazioni > Informazioni. `env` viene letto
  // durante la build e Next scrive il valore direttamente nel codice della
  // pagina: il browser non legge nessuna variabile d'ambiente, riceve solo
  // il testo (es. "0.1.0", "21a684b"). VERCEL_GIT_COMMIT_SHA la mette Vercel
  // in ogni build, gratis; in locale non c'è e il commit vale "sviluppo".
  // Non sono segreti: la versione è in package.json, il commit è l'hash
  // pubblico già visibile su GitHub.
  env: {
    VERSIONE_APP: pacchetto.version,
    COMMIT_APP: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "sviluppo",
  },
  // La vecchia pagina Profilo è diventata Impostazioni (PUNTO_DI_PARTENZA.md
  // sezione 3). Chi apre /profilo (un segnalibro vecchio) arriva
  // all'elenco. `permanent: false` = 307, redirect temporaneo: il browser non
  // lo memorizza per sempre come farebbe con un 308, quindi l'indirizzo
  // resta libero se un giorno servisse. Lo fa il server: offline non
  // risponde e compare "Sei offline".
  async redirects() {
    return [{ source: "/profilo", destination: "/impostazioni", permanent: false }];
  },
  // Next.js 16: quando `next dev` viene lanciato da un agente AI (es. Claude
  // Code, riconosciuto da @vercel/detect-agent) aggiunge in fondo a
  // CLAUDE.md un blocco "<!-- BEGIN:nextjs-agent-rules -->". CLAUDE.md è
  // scritto a mano e versionato: quel blocco finirebbe in un commit per
  // sbaglio. Spento qui.
  agentRules: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  // Evita che il browser/CDN mettano in cache il file del service worker:
  // altrimenti dopo un deploy gli utenti continuerebbero a usare la versione vecchia.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      // Caricato da sw.js con importScripts: stessa regola, altrimenti un
      // sw.js nuovo potrebbe girare con la sua logica vecchia.
      {
        source: "/sw-strategia.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;