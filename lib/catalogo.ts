import {
  buscarCatalogo as buscarCatalogoMangaDex,
  buscarObraPorId as buscarObraPorIdMangaDex,
  buscarPorTitulo as buscarPorTituloMangaDex,
  buscarCapitulosDaObra as buscarCapitulosDaObraMangaDex,
  buscarPaginasDoCapitulo as buscarPaginasDoCapituloMangaDex,
  executarEmLotes,
  type PaginasDoCapitulo,
} from "./mangadex";
import {
  ehIdMangaLivre,
  idParaSlugMangaLivre,
  buscarCatalogoMangaLivre,
  buscarObraPorSlugMangaLivre,
  buscarCapitulosDaObraMangaLivre,
  buscarPaginasDoCapituloMangaLivre,
  buscarPorTituloMangaLivre,
} from "./mangalivre";
import type { Obra, Capitulo, TipoObra } from "./types";

export type { PaginasDoCapitulo };

/**
 * Ponto único de acesso a dados de catálogo/obra/capítulo, usado por
 * toda a aplicação (páginas e Route Handlers) em vez de importar
 * `lib/mangadex.ts` ou `lib/mangalivre.ts` diretamente.
 *
 * A MangaDex é a fonte PADRÃO — catálogo mais estruturado, com filtro
 * de conteúdo e idioma já embutido na própria query. O MangaLivre é uma
 * fonte COMPLEMENTAR: entra só para aumentar a cobertura de obras/
 * capítulos em português (casos como uma obra popular cuja tradução
 * pt-BR na MangaDex parou em poucos capítulos).
 *
 * Ids de obras/capítulos do MangaLivre carregam o prefixo `ml:` (ver
 * lib/mangalivre.ts) — é por esse prefixo que decidimos para qual fonte
 * rotear cada chamada abaixo.
 */

/**
 * Decodifica o id recebido via parâmetro de rota antes de rotear pela
 * fonte correta. Necessário porque o `:` do prefixo `ml:` (ver
 * lib/mangalivre.ts) às vezes chega ainda percent-encoded como `%3A` —
 * o Next.js nem sempre decodifica segmentos dinâmicos com caracteres
 * especiais antes de expor `params` — e, sem isso, `ehIdMangaLivre`
 * nunca reconhece o prefixo e a chamada cai (errada) na MangaDex.
 * Decodificar um id que já está decodificado (sem `%`) é uma operação
 * neutra, então isto é seguro para ids da MangaDex também.
 */
export function decodificarId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

/**
 * Correções pontuais de classificação para obras específicas cuja fonte
 * (MangaLivre, neste caso) não expõe uma tag explícita de formato
 * ("manhwa"/"manhua") e por isso cai no padrão "manga" (ver `tipo` em
 * `buscarObraPorSlugMangaLivre`/`mapCardParaObra` em lib/mangalivre.ts).
 *
 * Mapa por id exato — nunca por título/gênero/heurística — para garantir
 * que a correção afete SÓ a obra listada aqui, nenhuma outra.
 *
 * "ml:regressao-absoluta" = Absolute Regression (Jeoldae Hoegwi): webtoon
 * coreano de Murim/regressão — confirmado como "manhwa" pela MangaDex
 * (originalLanguage "ko") para a mesma obra (sinopse idêntica, id
 * db1f4c31-f92f-4f4f-a8c6-fc898e432888), embora a página do MangaLivre
 * não tenha a tag "manhwa" cadastrada.
 */
const CORRECOES_DE_TIPO: Record<string, TipoObra> = {
  "ml:regressao-absoluta": "manhwa",
};

function corrigirObra(obra: Obra): Obra {
  const tipoCorrigido = CORRECOES_DE_TIPO[obra.id];
  return tipoCorrigido && obra.tipo !== tipoCorrigido ? { ...obra, tipo: tipoCorrigido } : obra;
}

function corrigirObras(obras: Obra[]): Obra[] {
  return obras.map(corrigirObra);
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
 * MangaDex/MangaLivre a cada carregamento do catálogo.
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

function normalizarParaComparar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Remove do MangaLivre qualquer obra cujo título já apareça na lista da
 * MangaDex — evita mostrar o mesmo título duas vezes (uma vez por
 * fonte) quando as duas o têm em catálogo.
 */
function semDuplicatas(referencia: Obra[], candidatas: Obra[]): Obra[] {
  const titulosExistentes = new Set(referencia.map((o) => normalizarParaComparar(o.titulo)));
  return candidatas.filter((o) => !titulosExistentes.has(normalizarParaComparar(o.titulo)));
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
  // entra numa divisão abaixo, então um `limit` <= 0 (vindo de uma chamada
  // direta a esta função, sem passar pela rota) geraria Infinity/NaN em
  // vez de uma paginação real.
  const limiteSeguro = Number.isFinite(limit) && limit > 0 ? limit : LIMITE_PADRAO_CATALOGO;
  const paginaMangaLivre = Math.floor(offset / limiteSeguro) + 1;

  const [doMangaDex, doMangaLivre] = await Promise.all([
    buscarCatalogoMangaDex(offset, limiteSeguro),
    buscarCatalogoMangaLivre(paginaMangaLivre, limiteSeguro).catch((err) => {
      console.warn("Falha ao buscar catálogo do MangaLivre — seguindo só com a MangaDex:", err);
      return [] as Obra[];
    }),
  ]);

  const mangaLivreSemDuplicatas = semDuplicatas(doMangaDex.traduzidas, doMangaLivre);

  // `temMais` é calculado ANTES do filtro de sequência abaixo — precisa
  // refletir se a fonte upstream ainda tem mais itens na próxima página,
  // não quantos itens desta página passaram na curadoria (senão
  // "carregar mais" poderia parecer esgotado só porque a página atual
  // teve muita obra removida por sequência quebrada).
  const temMais = doMangaDex.temMais || doMangaLivre.length >= limiteSeguro;

  const traduzidas = await filtrarPorSequenciaValida(
    corrigirObras([...doMangaDex.traduzidas, ...mangaLivreSemDuplicatas])
  );

  // `semTraducao` continua sem o filtro de sequência de propósito: toda
  // obra ali tem, por definição, ZERO capítulos pt-BR (é assim que ela
  // cai neste bucket em vez de em `traduzidas`) — isso não é uma
  // "sequência quebrada", é uma categoria diferente ("ainda não
  // traduzida", já com aviso próprio na UI). Aplicar a mesma regra
  // aqui esvaziaria essa lista por completo, o que vai além do pedido.
  const semTraducao = corrigirObras(doMangaDex.semTraducao);

  return { traduzidas, semTraducao, temMais };
}

export async function buscarObraPorId(idBruto: string): Promise<Obra | null> {
  const id = decodificarId(idBruto);
  const obra = ehIdMangaLivre(id)
    ? await buscarObraPorSlugMangaLivre(idParaSlugMangaLivre(id))
    : await buscarObraPorIdMangaDex(id);
  return obra ? corrigirObra(obra) : obra;
}

export async function buscarCapitulosDaObra(idBruto: string): Promise<Capitulo[]> {
  const id = decodificarId(idBruto);
  if (ehIdMangaLivre(id)) {
    return buscarCapitulosDaObraMangaLivre(idParaSlugMangaLivre(id));
  }
  return buscarCapitulosDaObraMangaDex(id);
}

export async function buscarPaginasDoCapitulo(capituloIdBruto: string): Promise<PaginasDoCapitulo> {
  const capituloId = decodificarId(capituloIdBruto);
  if (ehIdMangaLivre(capituloId)) {
    return buscarPaginasDoCapituloMangaLivre(idParaSlugMangaLivre(capituloId));
  }
  return buscarPaginasDoCapituloMangaDex(capituloId);
}

export async function buscarPorTitulo(
  query: string
): Promise<{ traduzidas: Obra[]; semTraducao: Obra[] }> {
  const [doMangaDex, doMangaLivre] = await Promise.all([
    buscarPorTituloMangaDex(query),
    buscarPorTituloMangaLivre(query).catch((err) => {
      console.warn(`Falha ao buscar "${query}" no MangaLivre:`, err);
      return [] as Obra[];
    }),
  ]);

  const traduzidas = await filtrarPorSequenciaValida(
    corrigirObras([...doMangaDex.traduzidas, ...semDuplicatas(doMangaDex.traduzidas, doMangaLivre)])
  );

  return {
    traduzidas,
    // Mesmo raciocínio de `buscarCatalogo`: obras sem tradução nenhuma
    // não são "sequência quebrada", são outra categoria — não filtradas
    // aqui.
    semTraducao: corrigirObras(doMangaDex.semTraducao),
  };
}
