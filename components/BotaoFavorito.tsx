"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFavoritos } from "@/hooks/useFavoritos";

export function BotaoFavorito({
  mangaId,
  titulo,
  capa,
  className = "",
}: {
  mangaId: string;
  titulo: string;
  capa: string | null;
  className?: string;
}) {
  const { estaFavoritado, alternar, usuarioLogado } = useFavoritos();
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();
  const favoritado = estaFavoritado(mangaId);

  async function ativar() {
    if (pendente) return;

    if (!usuarioLogado) {
      router.push("/entrar");
      return;
    }

    setPendente(true);
    setErro(null);
    const resultado = await alternar({ mangaId, titulo, capa });
    setPendente(false);

    if (!resultado.ok) {
      // A UI já foi revertida para o estado anterior (rollback otimista
      // dentro de useFavoritos) — aqui só avisamos por que nada mudou.
      setErro(resultado.erro ?? "Não foi possível atualizar seus favoritos agora.");
      window.setTimeout(() => setErro(null), 4000);
    }
  }

  // Botão real (<button>): os cards que usam este componente (ObraCard,
  // GradeFavoritos) posicionam-o como IRMÃO do link de navegação — nunca
  // mais aninhado dentro de um <a> —, então não há motivo para simular um
  // botão com <span role="button"> (um <button> nativo já resolve foco,
  // teclado e leitores de tela sem replicar esse comportamento manualmente).
  return (
    <>
      <button
        type="button"
        onClick={(evento) => {
          evento.preventDefault();
          evento.stopPropagation();
          void ativar();
        }}
        aria-pressed={favoritado}
        aria-label={favoritado ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        title={erro ?? (favoritado ? "Remover dos favoritos" : "Adicionar aos favoritos")}
        className={`flex cursor-pointer items-center justify-center rounded-full backdrop-blur transition-colors ${
          pendente ? "cursor-not-allowed opacity-60" : ""
        } ${erro ? "ring-2 ring-hanko" : ""} ${
          favoritado
            ? "bg-hanko text-paper hover:bg-hanko-hover"
            : "bg-ink-950/70 text-paper hover:bg-ink-900"
        } ${className}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill={favoritado ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1.8}
          className="h-[1.1em] w-[1.1em]"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.318 6.318a4.5 4.5 0 0 1 6.364 0L12 7.636l1.318-1.318a4.5 4.5 0 1 1 6.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 0 1 0-6.364Z"
          />
        </svg>
      </button>

      {/* Visualmente invisível, mas anunciado por leitores de tela — o
          contorno vermelho acima já é o aviso visual, sem quebrar o
          layout compacto deste botão (usado sobre a capa da obra). */}
      {erro && (
        <span role="alert" className="sr-only">
          {erro}
        </span>
      )}
    </>
  );
}
