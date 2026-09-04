import { getPasto } from "@/lib/actions/pasti";
import FormNuovoPasto from "@/components/FormNuovoPasto";
import { notFound } from "next/navigation";
import Link from "next/link";

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
    <main className="p-6 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-display font-semibold">Modifica pasto</h1>
        <Link
          href="/dashboard"
          className="text-sm underline rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          ← Torna a oggi
        </Link>
      </div>
      <FormNuovoPasto pastoEsistente={pasto} />
    </main>
  );
}
