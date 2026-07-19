import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="rounded-full bg-hanko px-3 py-1 text-xs font-display font-medium text-paper">
        404
      </span>
      <h1 className="font-display text-2xl font-semibold text-paper">
        Não encontramos essa página
      </h1>
      <p className="max-w-sm text-paper-muted">
        A obra pode ter sido removida da fonte de dados, ou o link está incorreto.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-card bg-hanko px-6 py-2.5 font-display font-medium text-paper transition-colors hover:bg-hanko-hover"
      >
        Voltar ao catálogo
      </Link>
    </main>
  );
}
