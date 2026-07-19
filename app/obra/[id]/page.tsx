import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  buscarObraPorId,
  buscarCapitulosDaObra,
  decodificarId,
  temSequenciaContinuaDesdeUm,
} from "@/lib/catalogo";
import type { Obra, Capitulo, TipoObra } from "@/lib/types";
import { BotaoFavorito } from "@/components/BotaoFavorito";
import { URL_DO_SITE } from "@/lib/site";

export const revalidate = 600; // ISR — acompanha o mesmo cache do catálogo

const ROTULO_TIPO: Record<TipoObra, string> = {
  manhwa: "Manhwa",
  manga: "Mangá",
  manhua: "Manhua",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const obra = await buscarObraPorId(decodificarId(id));
    if (!obra) {
      return { title: "Obra não encontrada" };
    }
    const descricao = obra.sinopse.slice(0, 160);
    return {
      title: obra.titulo,
      description: descricao,
      openGraph: {
        title: obra.titulo,
        description: descricao,
        images: obra.capa ? [obra.capa] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: obra.titulo,
        description: descricao,
        images: obra.capa ? [obra.capa] : undefined,
      },
    };
  } catch (err) {
    // Falha temporária ao buscar a obra: não deixamos isso derrubar a
    // geração de metadata da página inteira, só usamos um título genérico.
    console.error(`Falha ao gerar metadata da obra ${id}:`, err);
    return {};
  }
}

export default async function ObraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idBruto } = await params;
  const id = decodificarId(idBruto);

  let obra: Obra | null = null;
  let capitulos: Capitulo[] = [];
  let falhaTemporaria = false;

  try {
    [obra, capitulos] = await Promise.all([
      buscarObraPorId(id),
      buscarCapitulosDaObra(id),
    ]);
  } catch (err) {
    // buscarObraPorId propaga erros que não são 404 (timeout, rede, 5xx) —
    // isso não significa que a obra não existe, então não é um notFound().
    console.error(`Falha ao carregar a página da obra ${id}:`, err);
    falhaTemporaria = true;
  }

  if (falhaTemporaria) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-display text-xl text-paper">
          Não conseguimos carregar esta obra agora.
        </p>
        <p className="text-paper-muted">
          A fonte de dados pode estar indisponível. Tente novamente em instantes.
        </p>
      </main>
    );
  }

  if (!obra) {
    notFound();
  }

  // Curadoria do catálogo: obras traduzidas precisam ter uma sequência
  // contínua a partir do capítulo 1 (mesma regra aplicada na listagem,
  // em lib/catalogo.ts) — sem isso, um link direto/salvo continuaria
  // abrindo uma obra que já foi removida da vitrine. Obras SEM tradução
  // (`temTraducaoPtBr === false`) ficam de fora dessa checagem: elas têm
  // zero capítulos por definição, e isso é um estado normal e já tratado
  // na UI abaixo — não uma sequência "quebrada".
  if (obra.temTraducaoPtBr && !temSequenciaContinuaDesdeUm(capitulos)) {
    notFound();
  }

  const primeiroCapitulo = capitulos[0] ?? null;

  // JSON-LD (schema.org/Book — não existe um tipo dedicado a mangá/manhwa
  // amplamente suportado pelos buscadores) para a página da obra. `titulo`
  // e `sinopse` vêm de fontes externas (MangaDex/MangaLivre) — nunca
  // confiáveis por padrão — então usamos `JSON.stringify` (que já escapa
  // aspas/barras invertidas corretamente) e, além disso, escapamos "<"
  // manualmente: sem isso, um valor contendo literalmente "</script>"
  // fecharia esta tag de script mais cedo e injetaria HTML/script
  // arbitrário no restante da página.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Book",
    name: obra.titulo,
    author: obra.autor ?? undefined,
    genre: obra.generos.length > 0 ? obra.generos : undefined,
    image: obra.capa ?? undefined,
    description: obra.sinopse || undefined,
    url: `${URL_DO_SITE}/obra/${encodeURIComponent(obra.id)}`,
    inLanguage: "pt-BR",
  }).replace(/</g, "\\u003c");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="relative aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-card bg-ink-900 sm:w-52">
          {obra.capa ? (
            <Image
              src={obra.capa}
              alt={obra.titulo}
              fill
              className="object-cover"
              sizes="200px"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center text-paper-muted">
              Sem capa
            </div>
          )}
        </div>

        <div className="flex-1">
          <span className="inline-block rounded-full bg-hanko px-3 py-1 text-xs font-display font-medium text-paper">
            {ROTULO_TIPO[obra.tipo]}
          </span>

          <h1 className="mt-3 break-words font-display text-4xl font-extrabold uppercase leading-tight tracking-tight text-paper md:text-6xl">
            {obra.titulo}
          </h1>
          {obra.autor && (
            <p className="mt-1 text-paper-muted">{obra.autor}</p>
          )}
          <p className="mt-1 text-sm text-paper-muted">{obra.status}</p>

          {obra.generos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {obra.generos.map((genero) => (
                <span
                  key={genero}
                  className="rounded-full bg-ink-800 px-3 py-1 text-xs text-paper-muted"
                >
                  {genero}
                </span>
              ))}
            </div>
          )}

          {!obra.temTraducaoPtBr && (
            <p className="mt-3 text-sm text-hanko">
              Esta obra ainda não tem capítulos traduzidos em português.
            </p>
          )}

          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-paper-muted">
            {obra.sinopse || "Sem sinopse disponível."}
          </p>

          <div className="mt-6 flex items-center gap-3">
            {primeiroCapitulo && (
              <Link
                href={`/obra/${encodeURIComponent(obra.id)}/ler/${encodeURIComponent(primeiroCapitulo.id)}`}
                className="inline-block rounded-card bg-hanko px-6 py-2.5 font-display font-medium text-paper transition-colors hover:bg-hanko-hover"
              >
                Iniciar leitura
              </Link>
            )}

            <BotaoFavorito
              mangaId={obra.id}
              titulo={obra.titulo}
              capa={obra.capa}
              className="h-11 w-11 border border-ink-700 text-lg"
            />
          </div>
        </div>
      </div>

      {capitulos.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-lg font-semibold text-paper">
            Capítulos
          </h2>
          <ul className="divide-y divide-ink-700 rounded-card border border-ink-700">
            {capitulos.map((cap) => (
              <li key={cap.id}>
                {/* `min-w-0` + `truncate` no rótulo evitam que um título de
                    capítulo longo empurre a data para fora do card em telas
                    estreitas — sem isso, o flex item crescia até o
                    conteúdo, ignorando a largura do container. */}
                <Link
                  href={`/obra/${encodeURIComponent(obra.id)}/ler/${encodeURIComponent(cap.id)}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-paper transition-colors hover:bg-ink-900"
                >
                  <span className="min-w-0 truncate font-mono">
                    Cap. {cap.numero}
                    {cap.titulo ? ` — ${cap.titulo}` : ""}
                  </span>
                  {cap.publicadoEm && (
                    <span className="shrink-0 text-paper-muted">
                      {new Date(cap.publicadoEm).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
