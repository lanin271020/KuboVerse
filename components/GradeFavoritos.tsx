"use client";

import Link from "next/link";
import Image from "next/image";
import { useFavoritos } from "@/hooks/useFavoritos";
import { BotaoFavorito } from "@/components/BotaoFavorito";
import type { Favorite } from "@/types/database";

export function GradeFavoritos({ favoritosIniciais }: { favoritosIniciais: Favorite[] }) {
  const { estaFavoritado, carregando } = useFavoritos();

  // Enquanto o contexto ainda não confirmou a lista via navegador, confiamos
  // no que o servidor já renderizou — evita a lista "piscar" vazia.
  const favoritos = carregando
    ? favoritosIniciais
    : favoritosIniciais.filter((favorito) => estaFavoritado(favorito.manga_id));

  if (favoritos.length === 0) {
    return (
      <p className="text-sm text-paper-muted">
        Você ainda não favoritou nenhuma obra. Explore o{" "}
        <Link href="/" className="text-jade hover:text-jade-hover">
          catálogo
        </Link>{" "}
        e toque no coração de uma obra para salvá-la aqui.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {favoritos.map((favorito) => {
        const href = `/obra/${encodeURIComponent(favorito.manga_id)}`;
        return (
          <div
            key={favorito.id}
            className="group relative overflow-hidden rounded-card bg-ink-900 transition-transform duration-200 hover:-translate-y-1"
          >
            <div className="relative aspect-[2/3] w-full overflow-hidden">
              {/* Ver ObraCard.tsx: link irmão do BotaoFavorito, nunca
                  ancestral — um <button> aninhado num <a> não é válido. */}
              <Link href={href} aria-label={favorito.titulo} className="absolute inset-0 z-0">
                {favorito.capa ? (
                  <Image
                    src={favorito.capa}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 45vw, 200px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-ink-800 text-paper-muted">
                    Sem capa
                  </div>
                )}
              </Link>

              <BotaoFavorito
                mangaId={favorito.manga_id}
                titulo={favorito.titulo}
                capa={favorito.capa}
                className="absolute bottom-2 right-2 z-10 h-8 w-8 text-base"
              />
            </div>

            <Link href={href} aria-hidden tabIndex={-1} className="block p-3">
              <h3 className="line-clamp-2 font-display text-sm font-medium text-paper">
                {favorito.titulo}
              </h3>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
