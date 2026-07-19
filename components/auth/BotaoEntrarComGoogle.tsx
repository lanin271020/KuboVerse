import { acaoEntrarComGoogle } from "@/services/auth";
import { BotaoEnviarFormulario } from "@/components/auth/BotaoEnviarFormulario";

/**
 * O <form> em si não precisa de "use client" (aponta direto para uma
 * Server Action), mas o botão dentro dele é um Client Component
 * (BotaoEnviarFormulario, via useFormStatus) para se autodesabilitar
 * durante o redirecionamento — evita disparar duas requisições de OAuth
 * em paralelo com duplo clique.
 */
export function BotaoEntrarComGoogle() {
  return (
    <form action={acaoEntrarComGoogle}>
      <BotaoEnviarFormulario
        textoPendente="Redirecionando…"
        className="flex w-full items-center justify-center gap-2.5 rounded-card border border-ink-700 bg-ink-900 px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.7 5.7 0 0 1-2.35 3.5v2.9h3.8c2.22-2.05 3.6-5.07 3.6-8.64Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.92-2.9l-3.8-2.9c-1.06.7-2.42 1.14-4.12 1.14-3.16 0-5.84-2.09-6.8-4.96H1.22v3.03A11.99 11.99 0 0 0 12 24Z"
          />
          <path
            fill="#FBBC05"
            d="M5.2 14.38a7.14 7.14 0 0 1 0-4.76V6.6H1.22a11.99 11.99 0 0 0 0 10.8l3.98-3.02Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.83 0 3.47.63 4.76 1.85l3.37-3.37C17.94 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.22 6.6l3.98 3.02C6.16 6.84 8.84 4.75 12 4.75Z"
          />
        </svg>
        Continuar com Google
      </BotaoEnviarFormulario>
    </form>
  );
}
