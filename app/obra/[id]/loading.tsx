export default function CarregandoObra() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex animate-pulse flex-col gap-6 sm:flex-row">
        <div className="aspect-[2/3] w-40 rounded-card bg-ink-900 sm:w-52" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-16 rounded-full bg-ink-900" />
          <div className="h-7 w-2/3 rounded bg-ink-900" />
          <div className="h-4 w-1/3 rounded bg-ink-900" />
          <div className="h-20 w-full rounded bg-ink-900" />
        </div>
      </div>
    </main>
  );
}
