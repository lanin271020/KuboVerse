"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { useUsuarioSupabase } from "@/hooks/useUsuarioSupabase";
import { criarClienteSupabaseNavegador } from "@/lib/supabase/client";
import { acaoAdicionarFavorito, acaoRemoverFavorito } from "@/services/favorites";

type InfoFavorito = {
  mangaId: string;
  titulo: string;
  capa: string | null;
};

type ContextoFavoritos = {
  usuarioLogado: boolean;
  carregando: boolean;
  estaFavoritado: (mangaId: string) => boolean;
  alternar: (info: InfoFavorito) => Promise<{ ok: boolean; erro?: string }>;
};

const Contexto = createContext<ContextoFavoritos | null>(null);

/**
 * Provedor global do estado de favoritos do usuário logado. Busca a lista
 * completa de manga_ids favoritados uma única vez (via cliente do
 * navegador, protegido por RLS) e mantém em memória — cada <BotaoFavorito>
 * consulta esse estado compartilhado em vez de fazer sua própria consulta,
 * mesmo quando novos cards são carregados dinamicamente (ex.: "Carregar mais").
 */
export function FavoritosProvider({
  usuarioInicial,
  children,
}: {
  usuarioInicial: User | null;
  children: React.ReactNode;
}) {
  const { usuario } = useUsuarioSupabase(usuarioInicial);
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!usuario || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setFavoritos(new Set());
      setCarregando(false);
      return;
    }

    let cancelado = false;
    setCarregando(true);

    const supabase = criarClienteSupabaseNavegador();
    supabase
      .from("favorites")
      .select("manga_id")
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          console.error("Falha ao carregar favoritos:", error);
          setFavoritos(new Set());
        } else {
          setFavoritos(new Set((data ?? []).map((linha) => linha.manga_id)));
        }
        setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [usuario]);

  const estaFavoritado = useCallback(
    (mangaId: string) => favoritos.has(mangaId),
    [favoritos]
  );

  const alternar = useCallback(
    async (info: InfoFavorito) => {
      if (!usuario) {
        return { ok: false, erro: "Entre para favoritar obras." };
      }

      const jaFavoritado = favoritos.has(info.mangaId);

      setFavoritos((atual) => {
        const proximo = new Set(atual);
        if (jaFavoritado) proximo.delete(info.mangaId);
        else proximo.add(info.mangaId);
        return proximo;
      });

      const resultado = jaFavoritado
        ? await acaoRemoverFavorito(info.mangaId)
        : await acaoAdicionarFavorito(info);

      if (!resultado.ok) {
        // Desfaz a atualização otimista se a operação falhou no servidor.
        setFavoritos((atual) => {
          const proximo = new Set(atual);
          if (jaFavoritado) proximo.add(info.mangaId);
          else proximo.delete(info.mangaId);
          return proximo;
        });
      }

      return resultado;
    },
    [usuario, favoritos]
  );

  const valor = useMemo<ContextoFavoritos>(
    () => ({ usuarioLogado: usuario !== null, carregando, estaFavoritado, alternar }),
    [usuario, carregando, estaFavoritado, alternar]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useFavoritos(): ContextoFavoritos {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error("useFavoritos precisa ser usado dentro de <FavoritosProvider>.");
  }
  return contexto;
}
