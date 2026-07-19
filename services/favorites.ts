"use server";

import { revalidatePath } from "next/cache";
import { criarClienteSupabaseServidor } from "@/lib/supabase/server";
import { FavoritoInputSchema, MangaIdSchema } from "@/lib/validacao/favoritos";
import type { Favorite } from "@/types/database";

export type ResultadoFavorito = { ok: boolean; erro?: string };

const MENSAGEM_INDISPONIVEL = "Não foi possível atualizar seus favoritos agora.";

export async function acaoAdicionarFavorito(input: {
  mangaId: string;
  titulo: string;
  capa: string | null;
}): Promise<ResultadoFavorito> {
  const analisado = FavoritoInputSchema.safeParse(input);
  if (!analisado.success) {
    return { ok: false, erro: "Dados inválidos." };
  }

  try {
    const supabase = await criarClienteSupabaseServidor();
    const { data: sessao } = await supabase.auth.getUser();

    if (!sessao.user) {
      return { ok: false, erro: "Entre para favoritar obras." };
    }

    const { error } = await supabase.from("favorites").upsert(
      {
        user_id: sessao.user.id,
        manga_id: analisado.data.mangaId,
        titulo: analisado.data.titulo,
        capa: analisado.data.capa,
      },
      { onConflict: "user_id,manga_id" }
    );

    if (error) {
      console.error("Falha ao adicionar favorito:", error);
      return { ok: false, erro: MENSAGEM_INDISPONIVEL };
    }
  } catch (err) {
    console.error("Falha ao adicionar favorito:", err);
    return { ok: false, erro: MENSAGEM_INDISPONIVEL };
  }

  revalidatePath("/favoritos");
  return { ok: true };
}

export async function acaoRemoverFavorito(mangaId: string): Promise<ResultadoFavorito> {
  const analisado = MangaIdSchema.safeParse(mangaId);
  if (!analisado.success) {
    return { ok: false, erro: "Dados inválidos." };
  }

  try {
    const supabase = await criarClienteSupabaseServidor();
    const { data: sessao } = await supabase.auth.getUser();

    if (!sessao.user) {
      return { ok: false, erro: "Entre para gerenciar seus favoritos." };
    }

    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", sessao.user.id)
      .eq("manga_id", analisado.data);

    if (error) {
      console.error("Falha ao remover favorito:", error);
      return { ok: false, erro: MENSAGEM_INDISPONIVEL };
    }
  } catch (err) {
    console.error("Falha ao remover favorito:", err);
    return { ok: false, erro: MENSAGEM_INDISPONIVEL };
  }

  revalidatePath("/favoritos");
  return { ok: true };
}

export async function acaoListarFavoritos(): Promise<Favorite[]> {
  try {
    const supabase = await criarClienteSupabaseServidor();
    const { data: sessao } = await supabase.auth.getUser();
    if (!sessao.user) {
      return [];
    }

    const { data, error } = await supabase
      .from("favorites")
      .select("*")
      .eq("user_id", sessao.user.id)
      .order("data_adicionado", { ascending: false });

    if (error) {
      console.error("Falha ao listar favoritos:", error);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error("Falha ao listar favoritos:", err);
    return [];
  }
}
