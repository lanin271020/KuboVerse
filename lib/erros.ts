import type { AuthError } from "@supabase/supabase-js";

// "already registered"/"user already registered" de propósito NÃO estão
// aqui: revelar isso ao usuário permite enumeração de contas (descobrir
// se um e-mail específico já tem cadastro). Esse caso é tratado à parte
// em services/auth.ts (acaoCadastrar), com a MESMA mensagem usada para
// um cadastro novo — assim a resposta é indistinguível nos dois casos.
const MENSAGENS_CONHECIDAS: { contem: string; mensagem: string }[] = [
  { contem: "invalid login credentials", mensagem: "E-mail ou senha incorretos." },
  {
    contem: "password should be at least",
    mensagem: "A senha deve ter pelo menos 8 caracteres.",
  },
  {
    contem: "email not confirmed",
    mensagem: "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.",
  },
  {
    contem: "rate limit",
    mensagem: "Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.",
  },
  {
    contem: "unable to validate email address",
    mensagem: "Informe um e-mail válido.",
  },
  {
    contem: "same password",
    mensagem: "A nova senha precisa ser diferente da senha atual.",
  },
];

/**
 * Traduz mensagens de erro do Supabase Auth (em inglês) para algo amigável
 * em português, sem expor detalhes técnicos ao usuário final.
 */
export function mensagemAmigavelAuth(erro: AuthError): string {
  const mensagemOriginal = erro.message.toLowerCase();
  const encontrada = MENSAGENS_CONHECIDAS.find((item) =>
    mensagemOriginal.includes(item.contem)
  );
  return (
    encontrada?.mensagem ??
    "Não foi possível completar a operação agora. Tente novamente em instantes."
  );
}
