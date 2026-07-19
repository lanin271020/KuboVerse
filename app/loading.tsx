import { GradeEsqueleto } from "@/components/GradeEsqueleto";

export default function CarregandoHome() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 animate-pulse space-y-2">
        <div className="h-9 w-52 rounded bg-ink-900 sm:h-11" />
        <div className="h-4 w-72 rounded bg-ink-900" />
      </div>

      <div className="mb-8 h-11 max-w-md animate-pulse rounded-card bg-ink-900" />

      <GradeEsqueleto />
    </main>
  );
}
