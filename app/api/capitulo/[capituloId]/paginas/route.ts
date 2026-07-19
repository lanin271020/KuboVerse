import { NextRequest, NextResponse } from "next/server";
import {
  buscarPaginasDoCapitulo,
  buscarCapitulosDaObra,
  buscarObraPorId,
  temSequenciaContinuaDesdeUm,
} from "@/lib/catalogo";

// O token embutido nas URLs do MangaDex@Home tem vida curta. Esta rota
// existe para que o leitor (client component) possa pedir um conjunto
// novo de URLs para o MESMO capítulo quando uma imagem falha no meio de
// uma leitura longa, sem precisar recarregar a página inteira.
export const revalidate = 0;

// IDs reais (MangaDex) nunca passam disso — evita repassar entradas
// absurdamente longas para a API upstream.
const TAMANHO_MAXIMO_DO_ID = 200;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ capituloId: string }> }
) {
  const { capituloId } = await params;
  const obraId = request.nextUrl.searchParams.get("obraId") ?? "";

  if (
    capituloId.length === 0 ||
    capituloId.length > TAMANHO_MAXIMO_DO_ID ||
    obraId.length === 0 ||
    obraId.length > TAMANHO_MAXIMO_DO_ID
  ) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  // CRÍTICO para a curadoria de conteúdo adulto: antes só checávamos se
  // `capituloId` pertencia a `obraId`. Isso impedia misturar capítulo de
  // uma obra com id de outra, MAS ainda servia páginas se alguém
  // passasse o `obraId` REAL de uma obra adulta (já filtrada do
  // catálogo) junto com um capítulo dela — porque `buscarCapitulosDaObra`
  // não aplica o filtro de conteúdo. `buscarObraPorId` sim (contentRating/
  // tags/regex/denylist). Mesma régua da página do leitor.
  let obra;
  let capitulos;
  try {
    [obra, capitulos] = await Promise.all([
      buscarObraPorId(obraId),
      buscarCapitulosDaObra(obraId),
    ]);
  } catch (err) {
    console.error(`Falha ao validar obra/capítulo ${obraId}/${capituloId}:`, err);
    return NextResponse.json(
      { error: "Não foi possível confirmar este capítulo agora. Tente novamente." },
      { status: 502 }
    );
  }

  if (!obra) {
    return NextResponse.json({ error: "Capítulo não encontrado para esta obra." }, { status: 404 });
  }

  if (obra.temTraducaoPtBr && !temSequenciaContinuaDesdeUm(capitulos)) {
    return NextResponse.json({ error: "Capítulo não encontrado para esta obra." }, { status: 404 });
  }

  if (!capitulos.some((c) => c.id === capituloId)) {
    return NextResponse.json({ error: "Capítulo não encontrado para esta obra." }, { status: 404 });
  }

  try {
    const paginas = await buscarPaginasDoCapitulo(capituloId);
    if (paginas.data.length === 0) {
      return NextResponse.json(
        { error: "Não há páginas disponíveis para este capítulo agora." },
        { status: 502 }
      );
    }
    return NextResponse.json(paginas);
  } catch (err) {
    console.error(`Falha ao recarregar páginas do capítulo ${capituloId}:`, err);
    return NextResponse.json(
      { error: "Não foi possível recarregar as páginas agora." },
      { status: 502 }
    );
  }
}
