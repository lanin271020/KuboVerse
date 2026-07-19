"use server";

import { criarClienteSupabaseServidor } from "@/lib/supabase/server";
import { buscarPerfil, buscarPerfis } from "@/services/profiles";
import { avaliarComentario } from "@/lib/moderacao";
import {
  NovoComentarioSchema,
  EditarComentarioSchema,
  ComentarioIdSchema,
  primeiraMensagemDeErro,
} from "@/lib/validacao/comentarios";
import type { Comment } from "@/types/database";

export type ComentarioComPerfil = Comment & {
  autorNome: string;
  autorAvatar: string | null;
};

export type ResultadoComentario = { ok: boolean; erro?: string };
export type ResultadoNovoComentario = ResultadoComentario & { comentario?: ComentarioComPerfil };

const MENSAGEM_INDISPONIVEL = "Não foi possível enviar seu comentário agora.";
const NOME_PADRAO = "Usuário";

// A partir de quantas denúncias diferentes um comentário sai da listagem
// pública automaticamente — sem esperar uma moderação manual que este
// projeto ainda não tem painel para fazer (ver comment_reports na
// migração 20260719000000). Um número baixo de propósito: falso positivo
// aqui só esconde um comentário (reversível se as denúncias forem
// removidas), enquanto não ocultar é o risco real num site infantil.
const LIMITE_DENUNCIAS_PARA_OCULTAR = 3;

function comPerfil(
  comentario: Comment,
  perfil: { nome: string | null; avatar_url: string | null } | undefined
): ComentarioComPerfil {
  return {
    ...comentario,
    autorNome: perfil?.nome?.trim() || NOME_PADRAO,
    autorAvatar: perfil?.avatar_url ?? null,
  };
}

/**
 * Lista os comentários de um capítulo específico, mais recentes primeiro,
 * já com nome/avatar do autor de cada um (buscados em lote, não um a um).
 */
export async function acaoListarComentarios(
  mangaId: string,
  chapterId: string
): Promise<ComentarioComPerfil[]> {
  try {
    const supabase = await criarClienteSupabaseServidor();
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("manga_id", mangaId)
      .eq("chapter_id", chapterId)
      // Some da listagem pública qualquer comentário que já acumulou
      // denúncias suficientes — ver LIMITE_DENUNCIAS_PARA_OCULTAR.
      .lt("denuncias_count", LIMITE_DENUNCIAS_PARA_OCULTAR)
      .order("criado_em", { ascending: false });

    if (error) {
      console.error("Falha ao listar comentários:", error);
      return [];
    }

    const comentarios = data ?? [];
    if (comentarios.length === 0) return [];

    const perfis = await buscarPerfis(comentarios.map((c) => c.user_id));
    return comentarios.map((c) => comPerfil(c, perfis.get(c.user_id)));
  } catch (err) {
    console.error("Falha ao listar comentários:", err);
    return [];
  }
}

export async function acaoCriarComentario(input: {
  mangaId: string;
  chapterId: string;
  comentario: string;
}): Promise<ResultadoNovoComentario> {
  const analisado = NovoComentarioSchema.safeParse(input);
  if (!analisado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(analisado.error) };
  }

  // Moderação de conteúdo ANTES de qualquer escrita no banco — ver
  // lib/moderacao.ts. Bloqueia no envio, não depois de já publicado.
  const moderacao = avaliarComentario(analisado.data.comentario);
  if (!moderacao.permitido) {
    return { ok: false, erro: moderacao.mensagem };
  }

  try {
    const supabase = await criarClienteSupabaseServidor();
    const { data: sessao } = await supabase.auth.getUser();

    if (!sessao.user) {
      return { ok: false, erro: "Entre para participar da comunidade." };
    }

    const { data, error } = await supabase
      .from("comments")
      .insert({
        user_id: sessao.user.id,
        manga_id: analisado.data.mangaId,
        chapter_id: analisado.data.chapterId,
        comentario: analisado.data.comentario,
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error("Falha ao criar comentário:", error);
      return { ok: false, erro: MENSAGEM_INDISPONIVEL };
    }

    const perfil = await buscarPerfil(sessao.user.id);
    return { ok: true, comentario: comPerfil(data, perfil ?? undefined) };
  } catch (err) {
    console.error("Falha ao criar comentário:", err);
    return { ok: false, erro: MENSAGEM_INDISPONIVEL };
  }
}

export async function acaoEditarComentario(input: {
  id: string;
  comentario: string;
}): Promise<ResultadoComentario> {
  const analisado = EditarComentarioSchema.safeParse(input);
  if (!analisado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(analisado.error) };
  }

  const moderacao = avaliarComentario(analisado.data.comentario);
  if (!moderacao.permitido) {
    return { ok: false, erro: moderacao.mensagem };
  }

  try {
    const supabase = await criarClienteSupabaseServidor();
    const { data: sessao } = await supabase.auth.getUser();

    if (!sessao.user) {
      return { ok: false, erro: "Entre para editar seu comentário." };
    }

    // O filtro por user_id é defesa em profundidade — a RLS já impede
    // editar comentário de outra pessoa (a policy comments_update_proprio
    // faz exatamente essa checagem no banco).
    const { error } = await supabase
      .from("comments")
      .update({ comentario: analisado.data.comentario })
      .eq("id", analisado.data.id)
      .eq("user_id", sessao.user.id);

    if (error) {
      console.error("Falha ao editar comentário:", error);
      return { ok: false, erro: MENSAGEM_INDISPONIVEL };
    }
  } catch (err) {
    console.error("Falha ao editar comentário:", err);
    return { ok: false, erro: MENSAGEM_INDISPONIVEL };
  }

  return { ok: true };
}

export async function acaoExcluirComentario(id: string): Promise<ResultadoComentario> {
  const analisado = ComentarioIdSchema.safeParse(id);
  if (!analisado.success) {
    return { ok: false, erro: "Comentário inválido." };
  }

  try {
    const supabase = await criarClienteSupabaseServidor();
    const { data: sessao } = await supabase.auth.getUser();

    if (!sessao.user) {
      return { ok: false, erro: "Entre para excluir seu comentário." };
    }

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", analisado.data)
      .eq("user_id", sessao.user.id);

    if (error) {
      console.error("Falha ao excluir comentário:", error);
      return { ok: false, erro: MENSAGEM_INDISPONIVEL };
    }
  } catch (err) {
    console.error("Falha ao excluir comentário:", err);
    return { ok: false, erro: MENSAGEM_INDISPONIVEL };
  }

  return { ok: true };
}

/**
 * Denuncia um comentário — a trigger `ao_denunciar_comentario` (ver
 * migração 20260719000000) incrementa `denuncias_count` no banco; a
 * partir de LIMITE_DENUNCIAS_PARA_OCULTAR o comentário some da listagem
 * pública automaticamente (`acaoListarComentarios` já filtra por isso).
 * O `unique (comment_id, reporter_id)` no banco impede a mesma pessoa de
 * denunciar duas vezes — tratamos essa violação como sucesso silencioso
 * (o objetivo, "estar denunciado", já foi alcançado antes).
 */
export async function acaoDenunciarComentario(comentarioId: string): Promise<ResultadoComentario> {
  const analisado = ComentarioIdSchema.safeParse(comentarioId);
  if (!analisado.success) {
    return { ok: false, erro: "Comentário inválido." };
  }

  try {
    const supabase = await criarClienteSupabaseServidor();
    const { data: sessao } = await supabase.auth.getUser();

    if (!sessao.user) {
      return { ok: false, erro: "Entre para denunciar um comentário." };
    }

    const { error } = await supabase.from("comment_reports").insert({
      comment_id: analisado.data,
      reporter_id: sessao.user.id,
    });

    // Código 23505 = unique_violation — já denunciado por este usuário,
    // não é um erro real do ponto de vista de quem denunciou.
    if (error && error.code !== "23505") {
      console.error("Falha ao denunciar comentário:", error);
      return { ok: false, erro: "Não foi possível registrar a denúncia agora." };
    }
  } catch (err) {
    console.error("Falha ao denunciar comentário:", err);
    return { ok: false, erro: "Não foi possível registrar a denúncia agora." };
  }

  return { ok: true };
}
