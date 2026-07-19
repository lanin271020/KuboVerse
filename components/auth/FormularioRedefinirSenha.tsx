"use client";

import { useActionState } from "react";
import { acaoRedefinirSenha } from "@/services/auth";
import { ESTADO_INICIAL_AUTH } from "@/lib/estadoFormularioAuth";

const CLASSE_INPUT =
  "w-full rounded-card border border-ink-700 bg-ink-900 px-4 py-2.5 text-paper placeholder:text-paper-muted focus:border-jade focus:outline-none";
const CLASSE_LABEL = "mb-1.5 block text-sm text-paper-muted";

export function FormularioRedefinirSenha() {
  const [estado, acao, pendente] = useActionState(acaoRedefinirSenha, ESTADO_INICIAL_AUTH);

  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="senha" className={CLASSE_LABEL}>
          Nova senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          autoComplete="new-password"
          minLength={6}
          maxLength={72}
          className={CLASSE_INPUT}
        />
      </div>

      <div>
        <label htmlFor="confirmarSenha" className={CLASSE_LABEL}>
          Confirmar nova senha
        </label>
        <input
          id="confirmarSenha"
          name="confirmarSenha"
          type="password"
          required
          autoComplete="new-password"
          minLength={6}
          maxLength={72}
          className={CLASSE_INPUT}
        />
      </div>

      {estado.erro && (
        <p role="alert" className="text-sm text-hanko">
          {estado.erro}
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="rounded-card bg-hanko px-6 py-2.5 font-display font-medium text-paper transition-colors hover:bg-hanko-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pendente ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
