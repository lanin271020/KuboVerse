export default function CarregandoLeitor() {
  return (
    <div className="flex min-h-screen animate-pulse flex-col items-center justify-center gap-3 bg-ink-950">
      <div className="h-64 w-44 rounded-card bg-ink-900" />
      <p className="text-sm text-paper-muted">Carregando capítulo…</p>
    </div>
  );
}
