"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { useUsuarioSupabase } from "@/hooks/useUsuarioSupabase";
import { acaoSair } from "@/services/auth";
import { BotaoEnviarFormulario } from "@/components/auth/BotaoEnviarFormulario";

export function Header({ usuarioInicial }: { usuarioInicial: User | null }) {
  const { usuario } = useUsuarioSupabase(usuarioInicial);
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fecharAoClicarFora(evento: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(evento.target as Node)) {
        setMenuAberto(false);
      }
    }
    document.addEventListener("mousedown", fecharAoClicarFora);
    return () => document.removeEventListener("mousedown", fecharAoClicarFora);
  }, []);

  // `user_metadata.nome` vem do cadastro (ver acaoCadastrar em
  // services/auth.ts) e está disponível direto no objeto de sessão, sem
  // round-trip extra ao Supabase — só fica desatualizado se o usuário
  // trocar o nome em "Meu perfil" (que grava em `profiles`, não aqui) até
  // o próximo login. Aceitável para um rótulo secundário no menu; a
  // página de perfil em si sempre mostra o nome atualizado.
  const nomeCadastro =
    typeof usuario?.user_metadata?.nome === "string" ? usuario.user_metadata.nome : null;
  const nome = usuario ? nomeCadastro || usuario.email || "Minha conta" : "";
  const inicial = nome ? nome[0]!.toUpperCase() : "?";

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/95 backdrop-blur">
      <div className="relative mx-auto flex max-w-6xl items-center justify-center px-6 py-4">
        <Link
          href="/"
          aria-label="KuboVerse — início"
          className="flex items-center justify-center transition-opacity hover:opacity-90"
        >
          <Image
            src="/kuboverse-logo.png"
            alt="KuboVerse"
            width={280}
            height={72}
            priority
            className="h-10 w-auto object-contain sm:h-12"
          />
        </Link>

        <div className="absolute right-6 top-1/2 -translate-y-1/2">
          {usuario ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuAberto((atual) => !atual)}
                aria-haspopup="menu"
                aria-expanded={menuAberto}
                aria-label="Menu do usuário"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-jade font-display text-sm font-semibold text-ink-950 transition-colors hover:bg-jade-hover"
              >
                {inicial}
              </button>

              {menuAberto && (
                <div
                  role="menu"
                  className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-card border border-ink-700 bg-ink-900 shadow-lg"
                >
                  <p className="truncate border-b border-ink-700 px-4 py-2.5 text-xs text-paper-muted">
                    {nome}
                  </p>
                  <Link
                    href="/perfil"
                    role="menuitem"
                    onClick={() => setMenuAberto(false)}
                    className="block px-4 py-2.5 text-sm text-paper hover:bg-ink-800"
                  >
                    Meu perfil
                  </Link>
                  <Link
                    href="/favoritos"
                    role="menuitem"
                    onClick={() => setMenuAberto(false)}
                    className="block px-4 py-2.5 text-sm text-paper hover:bg-ink-800"
                  >
                    Meus favoritos
                  </Link>
                  <form action={acaoSair}>
                    <BotaoEnviarFormulario
                      role="menuitem"
                      textoPendente="Saindo…"
                      className="block w-full px-4 py-2.5 text-left text-sm text-hanko hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Sair
                    </BotaoEnviarFormulario>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/entrar"
              className="rounded-card bg-hanko px-4 py-2 text-sm font-display font-medium text-paper transition-colors hover:bg-hanko-hover"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
