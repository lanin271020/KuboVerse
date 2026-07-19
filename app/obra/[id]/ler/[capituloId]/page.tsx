import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  buscarObraPorId,
  buscarCapitulosDaObra,
  buscarPaginasDoCapitulo,
  decodificarId,
  temSequenciaContinuaDesdeUm,
  type PaginasDoCapitulo,
} from "@/lib/catalogo";
import { LeitorCapitulo } from "@/components/LeitorCapitulo";
import { ComentariosCapitulo, type UsuarioAtualComentario } from "@/components/ComentariosCapitulo";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { buscarPerfil } from "@/services/profiles";
import { acaoListarComentarios } from "@/services/comments";
import { buscarProgresso } from "@/services/history";
import type { Obra, Capitulo } from "@/lib/types";

// As URLs das páginas vêm de /at-home/server com um token de curta
// duração — cachear esta rota serviria imagens expiradas. Cada acesso
// busca um conjunto novo de URLs.
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; capituloId: string }>;
}): Promise<Metadata> {
  const { id: idBruto, capituloId: capituloIdBruto } = await params;
  try {
    const id = decodificarId(idBruto);
    const capituloId = decodificarId(capituloIdBruto);
    const [obra, capitulos] = await Promise.all([
      buscarObraPorId(id),
      buscarCapitulosDaObra(id),
    ]);
    if (!obra) return { title: "Capítulo não encontrado" };

    const capitulo = capitulos.find((c) => c.id === capituloId);
    return {
      title: capitulo ? `${obra.titulo} — Cap. ${capitulo.numero}` : obra.titulo,
      description: obra.sinopse.slice(0, 160),
      // Sempre noindex: são milhares de páginas por capítulo, sem valor de
      // busca próprio (o valor de SEO está na página da obra), e as
      // imagens usadas aqui vêm de URLs assinadas de curta duração.
      robots: { index: false, follow: true },
    };
  } catch (err) {
    console.error(`Falha ao gerar metadata do leitor ${idBruto}/${capituloIdBruto}:`, err);
    return { robots: { index: false, follow: true } };
  }
}

export default async function LerCapituloPage({
  params,
}: {
  params: Promise<{ id: string; capituloId: string }>;
}) {
  const { id: idBruto, capituloId: capituloIdBruto } = await params;
  const id = decodificarId(idBruto);
  const capituloId = decodificarId(capituloIdBruto);

  let obra: Obra | null = null;
  let capitulos: Capitulo[] = [];
  let falhaTemporaria = false;

  try {
    [obra, capitulos] = await Promise.all([buscarObraPorId(id), buscarCapitulosDaObra(id)]);
  } catch (err) {
    // buscarObraPorId propaga erros que não são 404 (timeout, rede, 5xx).
    // Isso não significa que o capítulo não existe — é diferente de
    // um notFound() e merece uma tela de "tente novamente".
    console.error(`Falha ao carregar o leitor da obra ${id}, capítulo ${capituloId}:`, err);
    falhaTemporaria = true;
  }

  if (falhaTemporaria) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-display text-xl text-paper">
          Não conseguimos carregar este capítulo agora.
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

  // Mesma curadoria da página da obra (ver app/obra/[id]/page.tsx): uma
  // obra removida do catálogo por sequência quebrada não deve continuar
  // legível via link direto/salvo para um capítulo específico.
  if (obra.temTraducaoPtBr && !temSequenciaContinuaDesdeUm(capitulos)) {
    notFound();
  }

  const indiceAtual = capitulos.findIndex((c) => c.id === capituloId);

  // CRÍTICO para a curadoria de conteúdo adulto, não só navegação: sem
  // esta checagem, `buscarPaginasDoCapitulo(capituloId)` era chamada com
  // QUALQUER capituloId da URL, sem confirmar que ele pertence à obra
  // (já filtrada) pedida. Um capituloId de uma obra adulta combinado com
  // o `id` de uma obra segura ainda assim exibia as páginas daquele
  // outro capítulo no leitor — um bypass completo do filtro de
  // conteúdo. `capitulos` vem de `buscarCapitulosDaObra(id)`, que já é
  // escopada a ESTA obra (query `manga=${id}` na MangaDex), então "não
  // está na lista" só pode significar capítulo de outra obra, id
  // inválido ou link desatualizado — em qualquer um desses casos,
  // fail-closed: 404, nunca renderiza o leitor.
  if (indiceAtual === -1) {
    console.warn(
      `Capítulo ${capituloId} não pertence à obra ${id} (ou não existe) — bloqueado antes de buscar páginas.`
    );
    notFound();
  }

  const capituloAtual = capitulos[indiceAtual]!;
  const capituloAnterior = indiceAtual > 0 ? capitulos[indiceAtual - 1] : null;
  const proximoCapitulo = indiceAtual < capitulos.length - 1 ? capitulos[indiceAtual + 1] : null;

  // Só agora — com o capítulo confirmado como parte desta obra já filtrada
  // — buscamos as páginas de fato.
  let paginas: PaginasDoCapitulo;
  try {
    paginas = await buscarPaginasDoCapitulo(capituloId);
  } catch (err) {
    console.error(`Falha ao carregar páginas do capítulo ${capituloId} da obra ${id}:`, err);
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-display text-xl text-paper">
          Não conseguimos carregar este capítulo agora.
        </p>
        <p className="text-paper-muted">
          A fonte de dados pode estar indisponível. Tente novamente em instantes.
        </p>
      </main>
    );
  }

  if (paginas.data.length === 0) {
    notFound();
  }

  // Comentários, usuário atual e progresso salvo não bloqueiam a leitura
  // em si — falhas aqui (ex.: Supabase indisponível) já são tratadas
  // dentro de cada função, retornando listas/valores vazios/nulos.
  const usuario = await obterUsuarioAtual();
  const [perfil, comentariosIniciais, progresso] = await Promise.all([
    usuario ? buscarPerfil(usuario.id) : Promise.resolve(null),
    acaoListarComentarios(obra.id, capituloId),
    usuario ? buscarProgresso(obra.id) : Promise.resolve(null),
  ]);

  const usuarioAtual: UsuarioAtualComentario | null = usuario
    ? {
        id: usuario.id,
        nome: perfil?.nome?.trim() || "Usuário",
        avatar: perfil?.avatar_url ?? null,
      }
    : null;

  // "Continuar lendo" só faz sentido restaurar a página se o progresso
  // salvo for justamente PARA ESTE capítulo — reading_history guarda só a
  // última posição por obra (não por capítulo), então um progresso salvo
  // para outro capítulo desta mesma obra não deve mover a página aqui.
  const paginaInicial =
    progresso && progresso.capituloId === capituloId ? Math.max(0, progresso.paginaAtual - 1) : 0;

  return (
    <>
      <LeitorCapitulo
        obraId={obra.id}
        obraTitulo={obra.titulo}
        tipoObra={obra.tipo}
        capituloId={capituloId}
        numeroCapitulo={capituloAtual.numero}
        paginasAltaQualidade={paginas.data}
        paginasEconomiaDados={paginas.dataSaver}
        paginaInicial={paginaInicial}
        capituloAnteriorId={capituloAnterior?.id ?? null}
        proximoCapituloId={proximoCapitulo?.id ?? null}
      />
      <ComentariosCapitulo
        mangaId={obra.id}
        chapterId={capituloId}
        comentariosIniciais={comentariosIniciais}
        usuarioAtual={usuarioAtual}
      />
    </>
  );
}
