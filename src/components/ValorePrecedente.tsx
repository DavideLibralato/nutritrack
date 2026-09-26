// Sotto un campo del Profilo cambiato ma non ancora salvato: il valore di
// prima, finché non si preme Salva (o "Annulla modifiche"). Non compare se il
// campo è uguale a quello caricato.

export default function ValorePrecedente({
  visibile,
  valore,
}: {
  visibile: boolean;
  valore: string;
}) {
  if (!visibile) return null;
  return <p className="mt-1 text-sm text-muted">Prima: {valore === "" ? "vuoto" : valore}</p>;
}
