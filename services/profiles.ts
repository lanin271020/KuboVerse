import { criarClienteSupabaseServidor } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/**
 * Busca o perfil público (nome, avatar) de um usuário pelo id. Retorna
 * `null` tanto para "perfil inexistente" quanto para falhas de rede/consulta
 * — o chamador não precisa distinguir os dois casos, só decidir um fallback.
 */
export async function buscarPerfil(userId: string): Promise<Profile | null> {
  const supabase = await criarClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error(`Falha ao buscar perfil ${userId}:`, error);
    return null;
  }

  return data;
}

/**
 * Busca vários perfis de uma vez (ex.: para exibir autor de cada comentário
 * de uma lista) evitando N chamadas separadas.
 */
export async function buscarPerfis(userIds: string[]): Promise<Map<string, Profile>> {
  const idsUnicos = Array.from(new Set(userIds));
  if (idsUnicos.length === 0) {
    return new Map();
  }

  const supabase = await criarClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", idsUnicos);

  if (error) {
    console.error("Falha ao buscar perfis em lote:", error);
    return new Map();
  }

  return new Map((data ?? []).map((perfil) => [perfil.id, perfil]));
}
