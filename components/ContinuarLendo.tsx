import Link from "next/link";
import Image from "next/image";
import type { ItemContinuarLendo } from "@/services/history";

/**
 * Seção "Continuar lendo" — componente de apresentação puro (sem buscar
 * dados sozinho). Quem busca os itens é ContinuarLendoContainer.tsx, via
 * uma Route Handler própria — ver o comentário em
 * app/api/continuar-lendo/route.ts sobre por que essa separação existe
 * (preservar o cache/ISR da Home).
 */
export function ContinuarLendo({ itens }: { itens: ItemContinuarLendo[] }) {
  if (itens.length === 0) return null;

  return (
    <section aria-label="Continuar lendo" className="mb-10">
      <h2 className="mb-3 font-display text-xl font-bold text-paper">Continuar lendo</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {itens.map((item) => (
          <CardContinuarLendo key={item.obra.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function CardContinuarLendo({ item }: { item: ItemContinuarLendo }) {
  const { obra, capituloAtual } = item;
  const href = capituloAtual
    ? `/obra/${encodeURIComponent(obra.id)}/ler/${encodeURIComponent(capituloAtual.id)}`
    : `/obra/${encodeURIComponent(obra.id)}`;

  return (
    <Link
      href={href}
      className="group flex w-32 shrink-0 flex-col overflow-hidden rounded-card bg-ink-900 transition-transform duration-200 hover:-translate-y-1 sm:w-36"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        {obra.capa ? (
          <Image
            src={obra.capa}
            alt={obra.titulo}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="150px"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-ink-800 text-xs text-paper-muted">
            Sem capa
          </div>
        )}

        {capituloAtual && (
          <span className="absolute bottom-0 left-0 right-0 truncate bg-ink-950/85 px-2 py-1 text-xs font-mono text-paper">
            Cap. {capituloAtual.numero}
          </span>
        )}
      </div>
      <div className="p-2">
        <h3 className="line-clamp-2 font-display text-xs font-medium text-paper">
          {obra.titulo}
        </h3>
      </div>
    </Link>
  );
}
