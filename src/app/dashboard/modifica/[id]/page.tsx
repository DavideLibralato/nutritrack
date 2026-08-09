import { getPasto } from "@/lib/actions/pasti";
import FormNuovoPasto from "@/components/FormNuovoPasto";
import { notFound } from "next/navigation";

export default async function ModificaPastoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pasto = await getPasto(id);

  if (!pasto) {
    notFound();
  }

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold mb-4">Modifica pasto</h1>
      <FormNuovoPasto pastoEsistente={pasto} />
    </main>
  );
}