import { z } from "zod";

// Limites conservadores contra entradas maliciosas/abuso (payloads gigantes,
// e-mails inválidos, etc.) — validados antes de qualquer chamada ao Supabase.
export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Informe seu e-mail.")
  .max(254, "E-mail muito longo.")
  .email("Informe um e-mail válido.");

// 8 caracteres (não 6) seguindo a recomendação atual do NIST para senhas
// de usuário final — 6 era baixo demais para o mínimo absoluto do site,
// mesmo sem exigir mistura de símbolos/maiúsculas (comprimento importa
// mais que complexidade forçada, que costuma levar a padrões previsíveis
// como troca de "a" por "@").
export const SenhaSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(72, "A senha é muito longa.");

export const NomeSchema = z
  .string()
  .trim()
  .min(2, "Informe pelo menos 2 caracteres.")
  .max(60, "O nome é muito longo.");

export const LoginSchema = z.object({
  email: EmailSchema,
  senha: z.string().min(1, "Informe sua senha."),
});

export const CadastroSchema = z
  .object({
    nome: NomeSchema,
    email: EmailSchema,
    senha: SenhaSchema,
    confirmarSenha: z.string(),
  })
  .refine((dados) => dados.senha === dados.confirmarSenha, {
    message: "As senhas não coincidem.",
    path: ["confirmarSenha"],
  });

export const RecuperarSenhaSchema = z.object({
  email: EmailSchema,
});

export const RedefinirSenhaSchema = z
  .object({
    senha: SenhaSchema,
    confirmarSenha: z.string(),
  })
  .refine((dados) => dados.senha === dados.confirmarSenha, {
    message: "As senhas não coincidem.",
    path: ["confirmarSenha"],
  });

export const AtualizarPerfilSchema = z.object({
  nome: NomeSchema,
});

export function primeiraMensagemDeErro(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? "Dados inválidos.";
}
