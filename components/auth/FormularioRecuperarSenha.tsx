"use client";

import { useActionState } from "react";
import Link from "next/link";
import { acaoSolicitarRecuperacaoSenha } from "@/services/auth";
import { ESTADO_INICIAL_AUTH } from "@/lib/estadoFormularioAuth";

const CLASSE_INPUT =
  "w-full rounded-card border border-ink-700 bg-ink-900 px-4 py-2.5 text-paper placeholder:text-paper-muted focus:border-jade focus:outline-none";
const CLASSE_LABEL = "mb-1.5 block text-sm text-paper-muted";

export function FormularioRecuperarSenha() {
  const [estado, acao, pendente] = useActionState(
    acaoSolicitarRecuperacaoSenha,
    ESTADO_INICIAL_AUTH
  );

  if (estado.sucesso) {
    return (
      <div className="rounded-card border border-jade/40 bg-ink-900 px-4 py-3.5 text-sm text-paper">
        {estado.sucesso}
      </div>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-paper-muted">
        Informe o e-mail da sua conta. Vamos enviar um link para redefinir sua senha.
      </p>

      <div>
        <label htmlFor="email" className={CLASSE_LABEL}>
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
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
        {pendente ? "Enviando…" : "Enviar link de recuperação"}
      </button>

      <Link href="/entrar" className="text-sm text-jade hover:text-jade-hover">
        Voltar para o login
      </Link>
    </form>
  );
}
