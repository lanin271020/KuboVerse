"use server";

import { criarClienteSupabaseServidor } from "@/lib/supabase/server";
import { buscarObraPorId, buscarCapitulosDaObra } from "@/lib/catalogo";
import { executarEmLotes } from "@/lib/mangadex";
import { ProgressoLeituraSchema } from "@/lib/validacao/historico";
import type { Obra, Capitulo } from "@/lib/types";

export type ResultadoHistorico = { ok: boolean; erro?: string };

const MENSAGEM_INDISPONIVEL = "Não foi possível salvar seu progresso agora.";
const LIMITE_CONTINUAR_LENDO = 8;
const TAMANHO_DO_LOTE = 4;

/**
 * Salva/atualiza a posição de leitura do usuário para uma obra (upsert por
 * user_id + manga_id — guardamos só a última posição, não um histórico
 * completo de cada capítulo já lido). Chamado silenciosamente em segundo
 * plano pelo leitor; falhas aqui não devem incomodar quem está lendo, por
 * isso o chamador normalmente ignora o resultado.
 */
export async function acaoSalvarProgresso(input: {
  mangaId: string;
  capituloId: string;
  paginaAtual: number;
}): Promise<ResultadoHistorico> {
  const analisado = ProgressoLeituraSchema.safeParse(input);
  if (!analisado.success) {
    return { ok: false, erro: "Dados inválidos." };
  }

  try {
    const supabase = await criarClienteSupabaseServidor();
    const { data: sessao } = await supabase.auth.getUser();

    if (!sessao.user) {
      // Usuário não logado: não é um erro, só não há o que salvar.
      return { ok: false };
    }

    const { error } = await supabase.from("reading_history").upsert(
      {
        user_id: sessao.user.id,
        manga_id: analisado.data.mangaId,
        capitulo_id: analisado.data.capituloId,
        pagina_atual: analisado.data.paginaAtual,
      },
      { onConflict: "user_id,manga_id" }
    );

    if (error) {
      console.error("Falha ao salvar progresso de leitura:", error);
      return { ok: false, erro: MENSAGEM_INDISPONIVEL };
    }
  } catch (err) {
    console.error("Falha ao salvar progresso de leitura:", err);
    return { ok: false, erro: MENSAGEM_INDISPONIVEL };
  }

  return { ok: true };
}

/**
 * Busca a última posição de leitura salva do usuário para UMA obra
 * (reading_history guarda só uma linha por par user_id+manga_id — a mais
 * recente, não um histórico por capítulo). Usado pelo leitor para saber
 * em que página retomar quando o capítulo aberto é o mesmo em que o
 * progresso foi salvo (ver app/obra/[id]/ler/[capituloId]/page.tsx).
 */
export async function buscarProgresso(
  mangaId: string
): Promise<{ capituloId: string; paginaAtual: number } | null> {
  try {
    const supabase = await criarClienteSupabaseServidor();
    const { data: sessao } = await supabase.auth.getUser();
    if (!sessao.user) {
      return null;
    }

    const { data, error } = await supabase
      .from("reading_history")
      .select("capitulo_id, pagina_atual")
      .eq("user_id", sessao.user.id)
      .eq("manga_id", mangaId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return { capituloId: data.capitulo_id, paginaAtual: data.pagina_atual };
  } catch (err) {
    console.error(`Falha ao buscar progresso salvo da obra ${mangaId}:`, err);
    return null;
  }
}

export type ItemContinuarLendo = {
  obra: Obra;
  capituloAtual: Capitulo | null;
  paginaAtual: number;
  atualizadoEm: string;
};

/**
 * Lista as obras que o usuário está lendo, mais recentes primeiro, já
 * enriquecidas com dados ao vivo do catálogo (título/capa/capítulo atual) —
 * reading_history só guarda IDs, a fonte de verdade do resto continua sendo
 * lib/catalogo.ts, igual ao resto do site.
 */
export async function acaoListarContinuarLendo(): Promise<ItemContinuarLendo[]> {
  try {
    const supabase = await criarClienteSupabaseServidor();
    const { data: sessao } = await supabase.auth.getUser();
    if (!sessao.user) {
      return [];
    }

    const { data: historico, error } = await supabase
      .from("reading_history")
      .select("*")
      .eq("user_id", sessao.user.id)
      .order("atualizado_em", { ascending: false })
      .limit(LIMITE_CONTINUAR_LENDO);

    if (error) {
      console.error("Falha ao listar histórico de leitura:", error);
      return [];
    }

    if (!historico || historico.length === 0) {
      return [];
    }

    const itens = await executarEmLotes(historico, TAMANHO_DO_LOTE, async (entrada) => {
      try {
        const [obra, capitulos] = await Promise.all([
          buscarObraPorId(entrada.manga_id),
          buscarCapitulosDaObra(entrada.manga_id),
        ]);

        if (!obra) return null;

        const capituloAtual =
          capitulos.find((capitulo) => capitulo.id === entrada.capitulo_id) ?? null;

        const item: ItemContinuarLendo = {
          obra,
          capituloAtual,
          paginaAtual: entrada.pagina_atual,
          atualizadoEm: entrada.atualizado_em,
        };
        return item;
      } catch (err) {
        console.error(`Falha ao enriquecer histórico da obra ${entrada.manga_id}:`, err);
        return null;
      }
    });

    return itens.filter((item): item is ItemContinuarLendo => item !== null);
  } catch (err) {
    console.error("Falha ao listar histórico de leitura:", err);
    return [];
  }
}
