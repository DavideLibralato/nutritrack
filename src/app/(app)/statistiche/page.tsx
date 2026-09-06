// Segnaposto: le Statistiche sono il punto 6 dell'ordine di sviluppo
// (PUNTO_DI_PARTENZA.md, sezione 6). Esiste ora solo perché la tab bar ha
// tre voci e il link non deve portare a una pagina rotta.

export default function StatistichePage() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-display font-bold">Statistiche</h1>
      <p className="text-sm text-muted">
        Prossimamente: medie di calorie e proteine, grafico delle calorie
        giornaliere e andamento del peso.
      </p>
    </main>
  );
}
