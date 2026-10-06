import { defineConfig } from "vitest/config";
import path from "node:path";

// Fuso orario fisso per tutti i test, su qualsiasi computer. I test sulla
// mezzanotte (dataGiorno.test.ts, SheetDuplica.test.tsx) controllano che
// "oggi" sia quello dell'orologio locale e non UTC: alle 00:30 a Roma in UTC
// è ancora ieri. Su un computer impostato su UTC le due date coinciderebbero
// e quei test passerebbero anche col codice sbagliato. Si imposta qui, prima
// che partano i processi dei test, che ereditano le variabili d'ambiente.
process.env.TZ = "Europe/Rome";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.mts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
