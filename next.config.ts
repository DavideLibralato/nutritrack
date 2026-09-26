import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
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