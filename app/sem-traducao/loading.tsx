import { GradeEsqueleto } from "@/components/GradeEsqueleto";

export default function CarregandoSemTraducao() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="h-4 w-32 animate-pulse rounded bg-ink-900" />
      <div className="mb-8 mt-4 animate-pulse space-y-2">
        <div className="h-6 w-72 rounded bg-ink-900" />
        <div className="h-4 w-96 rounded bg-ink-900" />
      </div>
      <GradeEsqueleto />
    </main>
  );
}
