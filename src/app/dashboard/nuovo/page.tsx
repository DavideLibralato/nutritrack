// app/dashboard/nuovo/page.tsx
import FormNuovoPasto from "@/components/FormNuovoPasto";

export default function NuovoPastoPage() {
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold mb-4">Aggiungi pasto</h1>
      <FormNuovoPasto />
    </main>
  );
}