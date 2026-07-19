"use client";

import { useActionState } from "react";
import { acaoAtualizarPerfil } from "@/services/auth";
import { ESTADO_INICIAL_AUTH } from "@/lib/estadoFormularioAuth";

const CLASSE_INPUT =
  "w-full rounded-card border border-ink-700 bg-ink-900 px-4 py-2.5 text-paper placeholder:text-paper-muted focus:border-jade focus:outline-none";
const CLASSE_LABEL = "mb-1.5 block text-sm text-paper-muted";

export function FormularioPerfil({ nomeAtual }: { nomeAtual: string }) {
  const [estado, acao, pendente] = useActionState(acaoAtualizarPerfil, ESTADO_INICIAL_AUTH);

  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="nome" className={CLASSE_LABEL}>
          Nome
        </label>
        <input
          id="nome"
          name="nome"
          type="text"
          required
          defaultValue={nomeAtual}
          maxLength={60}
          className={CLASSE_INPUT}
        />
      </div>

      {estado.erro && (
        <p role="alert" className="text-sm text-hanko">
          {estado.erro}
        </p>
      )}
      {estado.sucesso && (
        <p role="status" className="text-sm text-jade">
          {estado.sucesso}
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="self-start rounded-card bg-hanko px-6 py-2.5 font-display font-medium text-paper transition-colors hover:bg-hanko-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pendente ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}
