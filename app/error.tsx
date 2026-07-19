"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error boundary de todas as rotas abaixo do layout raiz. Next.js exige
 * que seja um Client Component. Não mostramos `error.message` ao usuário
 * de propósito — pode conter detalhes internos (stack, query) que não são
 * informação para o visitante, só para os logs do servidor.
 */
export default function ErroDaRota({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro não tratado numa rota:", error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="rounded-full bg-hanko px-3 py-1 text-xs font-display font-medium text-paper">
        Ops
      </span>
      <h1 className="font-display text-2xl font-semibold text-paper">Algo deu errado</h1>
      <p className="max-w-sm text-paper-muted">
        Não foi possível concluir essa ação agora. Tente novamente em instantes.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          onClick={reset}
          className="rounded-card bg-hanko px-6 py-2.5 font-display font-medium text-paper transition-colors hover:bg-hanko-hover"
        >
          Tentar novamente
        </button>
        <Link
          href="/"
          className="rounded-card border border-ink-700 px-6 py-2.5 font-display font-medium text-paper transition-colors hover:border-jade hover:text-jade"
        >
          Voltar ao catálogo
        </Link>
      </div>
    </main>
  );
}
