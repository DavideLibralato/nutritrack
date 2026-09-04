// app/dashboard/nuovo/page.tsx
import Link from "next/link";
import FormNuovoPasto from "@/components/FormNuovoPasto";

export default function NuovoPastoPage() {
  return (
    <main className="p-6 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-display font-semibold">Aggiungi pasto</h1>
        <Link
          href="/dashboard"
          className="text-sm underline rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          ← Torna a oggi
        </Link>
      </div>
      <FormNuovoPasto />
    </main>
  );
}
