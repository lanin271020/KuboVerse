import Link from "next/link";
import Image from "next/image";
import type { Obra } from "@/lib/types";
import { BotaoFavorito } from "@/components/BotaoFavorito";

const ROTULO_TIPO: Record<Obra["tipo"], string> = {
  manhwa: "Manhwa",
  manga: "Mangá",
  manhua: "Manhua",
};

export function ObraCard({ obra }: { obra: Obra }) {
  const ehNovo =
    obra.capituloMaisRecentePtBr &&
    Date.now() - new Date(obra.capituloMaisRecentePtBr).getTime() < 1000 * 60 * 60 * 24 * 3; // 3 dias

  const href = `/obra/${encodeURIComponent(obra.id)}`;

  return (
    <div className="group relative overflow-hidden rounded-card bg-ink-900 transition-transform duration-200 hover:-translate-y-1">
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        {/* Link cobrindo só a capa — irmão do BotaoFavorito abaixo, nunca
            ancestral dele: um <button> aninhado num <a> não é HTML válido.
            Carrega o nome acessível do destino; o link do título abaixo é
            só um alvo de clique extra para mouse (ver aria-hidden nele). */}
        <Link href={href} aria-label={obra.titulo} className="absolute inset-0 z-0">
          {obra.capa ? (
            <Image
              src={obra.capa}
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

        {/* Selo "hanko" com o tipo da obra — assinatura visual do catálogo */}
        <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-hanko px-2.5 py-0.5 text-xs font-display font-medium text-paper">
          {ROTULO_TIPO[obra.tipo]}
        </span>

        {ehNovo && (
          <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-jade px-2.5 py-0.5 text-xs font-mono font-medium text-ink-950">
            novo
          </span>
        )}

        <BotaoFavorito
          mangaId={obra.id}
          titulo={obra.titulo}
          capa={obra.capa}
          className="absolute bottom-2 right-2 z-10 h-8 w-8 text-base"
        />
      </div>

      <Link href={href} aria-hidden tabIndex={-1} className="block p-3">
        <h3 className="line-clamp-2 font-display text-sm font-medium text-paper">
          {obra.titulo}
        </h3>
      </Link>
    </div>
  );
}
