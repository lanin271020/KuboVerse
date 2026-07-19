import { z } from "zod";

export const TipoObra = z.enum(["manhwa", "manga", "manhua"]);
export type TipoObra = z.infer<typeof TipoObra>;

export const CapituloSchema = z.object({
  id: z.string(),
  numero: z.string(),
  titulo: z.string().nullable(),
  idioma: z.string(),
  publicadoEm: z.string(),
});
export type Capitulo = z.infer<typeof CapituloSchema>;

export const ObraSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  autor: z.string().nullable(),
  status: z.string(),
  generos: z.array(z.string()),
  sinopse: z.string(),
  capa: z.string().url().nullable(),
  tipo: TipoObra,
  temTraducaoPtBr: z.boolean(),
  capituloMaisRecentePtBr: z.string().nullable(), // data ISO, para o selo "novo"
});
export type Obra = z.infer<typeof ObraSchema>;

export const CatalogoResponseSchema = z.object({
  traduzidas: z.array(ObraSchema),
  semTraducao: z.array(ObraSchema),
});
export type CatalogoResponse = z.infer<typeof CatalogoResponseSchema>;
