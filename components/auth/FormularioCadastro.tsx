"use client";

import { useActionState } from "react";
import Link from "next/link";
import { acaoCadastrar } from "@/services/auth";
import { ESTADO_INICIAL_AUTH } from "@/lib/estadoFormularioAuth";
import { BotaoEntrarComGoogle } from "@/components/auth/BotaoEntrarComGoogle";

const CLASSE_INPUT =
  "w-full rounded-card border border-ink-700 bg-ink-900 px-4 py-2.5 text-paper placeholder:text-paper-muted focus:border-jade focus:outline-none";
const CLASSE_LABEL = "mb-1.5 block text-sm text-paper-muted";

export function FormularioCadastro() {
  const [estado, acao, pendente] = useActionState(acaoCadastrar, ESTADO_INICIAL_AUTH);

  if (estado.sucesso) {
    return (
      <div className="rounded-card border border-jade/40 bg-ink-900 px-4 py-3.5 text-sm text-paper">
        {estado.sucesso}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BotaoEntrarComGoogle />

      <div className="flex items-center gap-3 text-xs text-paper-muted">
        <span className="h-px flex-1 bg-ink-700" />
        ou
        <span className="h-px flex-1 bg-ink-700" />
      </div>

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
            autoComplete="name"
            maxLength={60}
            className={CLASSE_INPUT}
          />
        </div>

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

        <div>
          <label htmlFor="senha" className={CLASSE_LABEL}>
            Senha
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
            Confirmar senha
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
          {pendente ? "Criando conta…" : "Criar conta"}
        </button>

        <p className="text-sm text-paper-muted">
          Já tem conta?{" "}
          <Link href="/entrar" className="text-jade hover:text-jade-hover">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
