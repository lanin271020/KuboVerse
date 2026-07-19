"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { acaoEntrar } from "@/services/auth";
import { ESTADO_INICIAL_AUTH } from "@/lib/estadoFormularioAuth";
import { BotaoEntrarComGoogle } from "@/components/auth/BotaoEntrarComGoogle";

const CLASSE_INPUT =
  "w-full rounded-card border border-ink-700 bg-ink-900 px-4 py-2.5 text-paper placeholder:text-paper-muted focus:border-jade focus:outline-none";
const CLASSE_LABEL = "mb-1.5 block text-sm text-paper-muted";

export function FormularioEntrar() {
  const [estado, acao, pendente] = useActionState(acaoEntrar, ESTADO_INICIAL_AUTH);
  const parametros = useSearchParams();
  const falhaGoogle = parametros.get("erro") === "google";

  return (
    <div className="flex flex-col gap-4">
      <BotaoEntrarComGoogle />

      {falhaGoogle && (
        <p role="alert" className="text-sm text-hanko">
          Não foi possível entrar com o Google agora. Tente de novo ou use e-mail e senha.
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-paper-muted">
        <span className="h-px flex-1 bg-ink-700" />
        ou
        <span className="h-px flex-1 bg-ink-700" />
      </div>

      <form action={acao} className="flex flex-col gap-4" noValidate>
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
            autoComplete="current-password"
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
          {pendente ? "Entrando…" : "Entrar"}
        </button>

        <div className="flex items-center justify-between text-sm">
          <Link href="/recuperar-senha" className="text-jade hover:text-jade-hover">
            Esqueci minha senha
          </Link>
          <Link href="/cadastro" className="text-jade hover:text-jade-hover">
            Criar conta
          </Link>
        </div>
      </form>
    </div>
  );
}
