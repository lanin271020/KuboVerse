/**
 * Skeleton de uma grade de cards de obra — mesmo grid do GradeCatalogo,
 * usado nas telas `loading.tsx` para evitar layout shift entre o
 * esqueleto e o conteúdo real.
 */
export function GradeEsqueleto({ quantidade = 10 }: { quantidade?: number }) {
  return (
    <div className="grid animate-pulse grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: quantidade }).map((_, indice) => (
        <div key={indice} className="overflow-hidden rounded-card bg-ink-900">
          <div className="aspect-[2/3] w-full bg-ink-800" />
          <div className="p-3">
            <div className="h-3.5 w-4/5 rounded bg-ink-800" />
          </div>
        </div>
      ))}
    </div>
  );
}
