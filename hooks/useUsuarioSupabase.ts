"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { criarClienteSupabaseNavegador } from "@/lib/supabase/client";

type EstadoUsuario = {
  usuario: User | null;
  carregando: boolean;
};

/**
 * Expõe o usuário autenticado (ou null) no lado do cliente, atualizando em
 * tempo real quando o estado de autenticação muda (login/logout em outra aba,
 * expiração de sessão, etc.).
 *
 * Recebe opcionalmente o usuário já resolvido no servidor (Server Component)
 * como valor inicial, para evitar o "flash" de estado deslogado enquanto o
 * cliente ainda não confirmou a sessão.
 */
export function useUsuarioSupabase(usuarioInicial: User | null = null): EstadoUsuario {
  const [estado, setEstado] = useState<EstadoUsuario>({
    usuario: usuarioInicial,
    carregando: false,
  });

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return;
    }

    const supabase = criarClienteSupabaseNavegador();

    const { data: assinatura } = supabase.auth.onAuthStateChange(
      (_evento, sessao) => {
        setEstado({ usuario: sessao?.user ?? null, carregando: false });
      }
    );

    return () => {
      assinatura.subscription.unsubscribe();
    };
  }, []);

  return estado;
}
