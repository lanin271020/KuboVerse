import { acaoSair } from "@/services/auth";
import { BotaoEnviarFormulario } from "@/components/auth/BotaoEnviarFormulario";

export function BotaoSair() {
  return (
    <form action={acaoSair}>
      <BotaoEnviarFormulario
        textoPendente="Saindo…"
        className="rounded-card border border-ink-700 px-5 py-2.5 text-sm font-medium text-hanko transition-colors hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Sair da conta
      </BotaoEnviarFormulario>
    </form>
  );
}
