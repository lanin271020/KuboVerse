import { z } from "zod";

export const ProgressoLeituraSchema = z.object({
  mangaId: z.string().trim().min(1, "Obra inválida.").max(300),
  capituloId: z.string().trim().min(1, "Capítulo inválido.").max(300),
  paginaAtual: z.number().int().min(0).max(5000),
});
