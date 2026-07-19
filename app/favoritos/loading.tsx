import { GradeEsqueleto } from "@/components/GradeEsqueleto";

export default function CarregandoFavoritos() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 h-9 w-52 animate-pulse rounded bg-ink-900 sm:h-11" />
      <GradeEsqueleto quantidade={5} />
    </main>
  );
}
