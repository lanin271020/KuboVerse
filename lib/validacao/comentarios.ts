import { z } from "zod";

// Mesmo limite do check constraint em public.comments (char_length between
// 1 and 2000) — validar aqui evita depender só do erro do banco, que
// chegaria com uma mensagem técnica pouco amigável.
export const ComentarioTextoSchema = z
  .string()
  .trim()
  .min(1, "Escreva algo antes de enviar.")
  .max(2000, "O comentário pode ter até 2000 caracteres.");

const IdExternoSchema = z.string().trim().min(1, "Identificador inválido.").max(300);

export const NovoComentarioSchema = z.object({
  mangaId: IdExternoSchema,
  chapterId: IdExternoSchema,
  comentario: ComentarioTextoSchema,
});

export const EditarComentarioSchema = z.object({
  id: z.string().uuid("Comentário inválido."),
  comentario: ComentarioTextoSchema,
});

export const ComentarioIdSchema = z.string().uuid("Comentário inválido.");

export function primeiraMensagemDeErro(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? "Dados inválidos.";
}
