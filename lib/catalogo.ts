import {
  buscarCatalogo as buscarCatalogoMangaDex,
  buscarObraPorId as buscarObraPorIdMangaDex,
  buscarPorTitulo as buscarPorTituloMangaDex,
  buscarCapitulosDaObra as buscarCapitulosDaObraMangaDex,
  buscarPaginasDoCapitulo as buscarPaginasDoCapituloMangaDex,
  executarEmLotes,
  type PaginasDoCapitulo,
} from "./mangadex";
import type { Obra, Capitulo } from "./types";

export type { PaginasDoCapitulo };

/**
 * Ponto único de acesso a dados de catálogo/obra/capítulo, usado por
 * toda a aplicação (páginas e Route Handlers) em vez de importar
 * `lib/mangadex.ts` diretamente.
 *
 * A MangaDex é a única fonte: catálogo estruturado, com filtro de
 * conteúdo e idioma já embutido na própria query. O MangaLivre foi
 * removido — a listagem de capítulos dele vinha com buracos/sem
 * sequência contínua desde o 1, incompatível com a curadoria do site.
 */

/**
 * Decodifica o id recebido via parâmetro de rota. Necessário porque
 * ids antigos com prefixo `ml:` (fonte descontinuada) às vezes chegam
 * percent-encoded como `%3A`, e o Next.js nem sempre decodifica
 * segmentos dinâmicos com caracteres especiais antes de expor `params`.
 * Decodificar um id que já está decodificado (sem `%`) é neutro.
 */
export function decodificarId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

/** Ids da fonte MangaLivre (descontinuada). Links antigos devem 404. */
function ehIdMangaLivreDescontinuado(id: string): boolean {
  return id.startsWith("ml:");
}

/**
 * Extrai, de uma lista de capítulos, o conjunto de números de capítulo
 * INTEIROS únicos (ex.: "10.5" conta como capítulo 10 — sub-capítulos/
 * extras não quebram nem "preenchem" sequência por si só, são só
 * arredondados para o inteiro correspondente). Entradas não numéricas
 * (ex.: "?", usado quando a fonte não informa o número) são ignoradas:
 * elas não provam nem desmentem uma sequência, então não participam da
 * checagem.
 */
function extrairNumerosDeCapitulo(capitulos: Capitulo[]): number[] {
  const numeros = new Set<number>();
  for (const cap of capitulos) {
    const valor = Number(cap.numero);
    if (Number.isFinite(valor) && valor > 0) {
      numeros.add(Math.floor(valor));
    }
  }
  return Array.from(numeros).sort((a, b) => a - b);
}

/**
 * Regra de curadoria do catálogo: só mantemos obras cuja tradução pt-BR
 * forma uma sequência contínua a partir do capítulo 1 (1, 2, 3, ... N —
 * sem começar em outro número e sem buracos no meio). Uma obra sem
 * nenhum capítulo numerado reconhecível também falha aqui (não tem como
 * começar "do capítulo 1" sem capítulo nenhum).
 */
export function temSequenciaContinuaDesdeUm(capitulos: Capitulo[]): boolean {
  const numeros = extrairNumerosDeCapitulo(capitulos);
  const primeiro = numeros[0];
  if (primeiro === undefined || primeiro !== 1) return false;

  let anterior = primeiro;
  for (const numero of numeros.slice(1)) {
    if (numero !== anterior + 1) return false;
    anterior = numero;
  }
  return true;
}

/**
 * Filtra uma lista de obras, mantendo só as que passam em
 * `temSequenciaContinuaDesdeUm`. Busca os capítulos de cada obra em
 * lotes (mesma técnica de `executarEmLotes` já usada para o selo
 * "novo") para não disparar dezenas de chamadas simultâneas contra a
 * MangaDex a cada carregamento do catálogo.
 *
 * Em caso de falha ao buscar os capítulos de uma obra específica, ela é
 * removida por precaução — sem conseguir confirmar a sequência, é mais
 * seguro não mostrar do que arriscar exibir algo quebrado (mesmo
 * critério de "prefira um catálogo menor, mas organizado").
 */
async function filtrarPorSequenciaValida(obras: Obra[]): Promise<Obra[]> {
  const resultados = await executarEmLotes(obras, 5, async (obra) => {
    try {
      const capitulos = await buscarCapitulosDaObra(obra.id);
      return temSequenciaContinuaDesdeUm(capitulos) ? obra : null;
    } catch (err) {
      console.warn(
        `Não foi possível validar a sequência de capítulos da obra "${obra.titulo}" (${obra.id}) — removida do catálogo por precaução:`,
        err
      );
      return null;
    }
  });
  return resultados.filter((obra): obra is Obra => obra !== null);
}

// Tamanho de página padrão do catálogo — exportado para que as páginas que
// chamam `buscarCatalogo()` sem argumentos (Home, /sem-traducao) possam
// informar ao GradeCatalogo exatamente quantos itens BRUTOS (antes da
// curadoria de sequência) já foram consumidos da fonte na primeira leva.
// Ver o comentário em `GradeCatalogo` sobre por que isso importa.
export const LIMITE_PADRAO_CATALOGO = 20;

export async function buscarCatalogo(
  offset: number = 0,
  limit: number = LIMITE_PADRAO_CATALOGO
): Promise<{ traduzidas: Obra[]; semTraducao: Obra[]; temMais: boolean }> {
  // Defesa extra além da validação em app/api/catalogo/route.ts: `limit`
  // entra em paginação abaixo; um `limit` <= 0 geraria comportamento
  // inválido.
  const limiteSeguro = Number.isFinite(limit) && limit > 0 ? limit : LIMITE_PADRAO_CATALOGO;

  const doMangaDex = await buscarCatalogoMangaDex(offset, limiteSeguro);

  // `temMais` é calculado ANTES do filtro de sequência abaixo — precisa
  // refletir se a fonte upstream ainda tem mais itens na próxima página,
  // não quantos itens desta página passaram na curadoria (senão
  // "carregar mais" poderia parecer esgotado só porque a página atual
  // teve muita obra removida por sequência quebrada).
  const temMais = doMangaDex.temMais;

  const traduzidas = await filtrarPorSequenciaValida(doMangaDex.traduzidas);

  // `semTraducao` continua sem o filtro de sequência de propósito: toda
  // obra ali tem, por definição, ZERO capítulos pt-BR (é assim que ela
  // cai neste bucket em vez de em `traduzidas`) — isso não é uma
  // "sequência quebrada", é uma categoria diferente ("ainda não
  // traduzida", já com aviso próprio na UI). Aplicar a mesma regra
  // aqui esvaziaria essa lista por completo, o que vai além do pedido.
  const semTraducao = doMangaDex.semTraducao;

  return { traduzidas, semTraducao, temMais };
}

export async function buscarObraPorId(idBruto: string): Promise<Obra | null> {
  const id = decodificarId(idBruto);
  if (ehIdMangaLivreDescontinuado(id)) return null;
  return buscarObraPorIdMangaDex(id);
}

export async function buscarCapitulosDaObra(idBruto: string): Promise<Capitulo[]> {
  const id = decodificarId(idBruto);
  if (ehIdMangaLivreDescontinuado(id)) return [];
  return buscarCapitulosDaObraMangaDex(id);
}

export async function buscarPaginasDoCapitulo(capituloIdBruto: string): Promise<PaginasDoCapitulo> {
  const capituloId = decodificarId(capituloIdBruto);
  if (ehIdMangaLivreDescontinuado(capituloId)) return { data: [], dataSaver: [] };
  return buscarPaginasDoCapituloMangaDex(capituloId);
}

export async function buscarPorTitulo(
  query: string
): Promise<{ traduzidas: Obra[]; semTraducao: Obra[] }> {
  const doMangaDex = await buscarPorTituloMangaDex(query);

  const traduzidas = await filtrarPorSequenciaValida(doMangaDex.traduzidas);

  return {
    traduzidas,
    // Mesmo raciocínio de `buscarCatalogo`: obras sem tradução nenhuma
    // não são "sequência quebrada", são outra categoria — não filtradas
    // aqui.
    semTraducao: doMangaDex.semTraducao,
  };
}
