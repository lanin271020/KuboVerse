import { z } from "zod";

// `.url()` sozinho aceita QUALQUER esquema válido de URL (ex.:
// "javascript:", "data:", "file:") — não só http(s). Como este valor é
// gravado no banco e depois renderizado via next/image, restringir
// explicitamente a http/https é defesa em profundidade: não confiar
// silenciosamente que "é uma URL" já implica "é seguro carregar como
// imagem".
const CapaSchema = z
  .string()
  .trim()
  .max(2048)
  .url("Capa inválida.")
  .refine((valor) => /^https?:\/\//i.test(valor), "Capa inválida.")
  .nullable();

export const FavoritoInputSchema = z.object({
  mangaId: z.string().trim().min(1, "Obra inválida.").max(300),
  titulo: z.string().trim().min(1, "Obra inválida.").max(300),
  capa: CapaSchema,
});

export const MangaIdSchema = z.string().trim().min(1, "Obra inválida.").max(300);
