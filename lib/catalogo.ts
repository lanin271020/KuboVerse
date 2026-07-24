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
  ehObraPrioritariaMangaLivre,
  buscarCatalogoMangaLivre,
  buscarObraPorSlugMangaLivre,
  buscarCapitulosDaObraMangaLivre,
  buscarPaginasDoCapituloMangaLivre,
  buscarPorTituloMangaLivre,
} from "./mangalivre";
import type { Obra, Capitulo } from "./types";

export type { PaginasDoCapitulo };

/**
 * Ponto único de acesso a dados de catálogo/obra/capítulo, usado por
 * toda a aplicação (páginas e Route Handlers) em vez de importar
 * `lib/mangadex.ts` ou `lib/mangalivre.ts` diretamente.
 *
 * A MangaDex é a fonte PADRÃO. O MangaLivre é fonte SECUNDÁRIA e só
 * contribui com manhwa (coreano) e mangá shonen — ver filtro em
 * `passaCuradoriaTipoMangaLivre` em lib/mangalivre.ts.
 *
 * Ids de obras/capítulos do MangaLivre carregam o prefixo `ml:`.
 */

/**
 * Decodifica o id recebido via parâmetro de rota antes de rotear pela
 * fonte correta. Necessário porque o `:` do prefixo `ml:` às vezes chega
 * ainda percent-encoded como `%3A`.
 */
export function decodificarId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

/**
 * Extrai, de uma lista de capítulos, o conjunto de números de capítulo
 * INTEIROS únicos (ex.: "10.5" conta como capítulo 10).
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
 * Regra de curadoria: tradução pt-BR em sequência contínua a partir do
 * capítulo 1 (1, 2, 3, … N), sem buracos.
 *
 * Obras prioritárias do MangaLivre (pedidas explicitamente, ex.: One Punch
 * Man) só precisam ter capítulos listados — a listagem do site costuma
 * ter buracos mesmo com centenas de caps disponíveis.
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

export function traducaoEstaDisponivelParaLeitura(
  obraId: string,
  capitulos: Capitulo[]
): boolean {
  if (ehObraPrioritariaMangaLivre(obraId)) {
    return capitulos.length > 0;
  }
  return temSequenciaContinuaDesdeUm(capitulos);
}

async function filtrarPorSequenciaValida(obras: Obra[]): Promise<Obra[]> {
  const resultados = await executarEmLotes(obras, 5, async (obra) => {
    try {
      const capitulos = await buscarCapitulosDaObra(obra.id);
      return traducaoEstaDisponivelParaLeitura(obra.id, capitulos) ? obra : null;
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
 * Mescla MangaDex + MangaLivre sem repetir título. Quando o mesmo título
 * aparece nas duas, fica a obra com mais capítulos na sequência válida
 * (ex.: Jujutsu Kaisen — 3 caps na MangaDex vs 271 no MangaLivre).
 */
async function mesclarPreferindoMaisCapitulos(
  primarias: Obra[],
  secundarias: Obra[]
): Promise<Obra[]> {
  const porTitulo = new Map<string, Obra>();

  async function considerar(obra: Obra) {
    const chave = normalizarParaComparar(obra.titulo);
    const atual = porTitulo.get(chave);
    if (!atual) {
      porTitulo.set(chave, obra);
      return;
    }
    try {
      const [capsAtual, capsNova] = await Promise.all([
        buscarCapitulosDaObra(atual.id),
        buscarCapitulosDaObra(obra.id),
      ]);
      const nAtual = traducaoEstaDisponivelParaLeitura(atual.id, capsAtual)
        ? capsAtual.length
        : 0;
      const nNova = traducaoEstaDisponivelParaLeitura(obra.id, capsNova)
        ? capsNova.length
        : 0;
      if (nNova > nAtual) porTitulo.set(chave, obra);
    } catch {
      // Mantém a que já estava se não der para comparar.
    }
  }

  for (const obra of primarias) await considerar(obra);
  for (const obra of secundarias) await considerar(obra);
  return Array.from(porTitulo.values());
}

export const LIMITE_PADRAO_CATALOGO = 20;

export async function buscarCatalogo(
  offset: number = 0,
  limit: number = LIMITE_PADRAO_CATALOGO
): Promise<{ traduzidas: Obra[]; semTraducao: Obra[]; temMais: boolean }> {
  const limiteSeguro = Number.isFinite(limit) && limit > 0 ? limit : LIMITE_PADRAO_CATALOGO;
  const paginaMangaLivre = Math.floor(offset / limiteSeguro) + 1;

  const [doMangaDex, doMangaLivre] = await Promise.all([
    buscarCatalogoMangaDex(offset, limiteSeguro),
    buscarCatalogoMangaLivre(paginaMangaLivre, limiteSeguro).catch((err) => {
      console.warn("Falha ao buscar catálogo do MangaLivre — seguindo só com a MangaDex:", err);
      return [] as Obra[];
    }),
  ]);

  const mescladas = await mesclarPreferindoMaisCapitulos(
    doMangaDex.traduzidas,
    doMangaLivre
  );

  const temMais = doMangaDex.temMais || doMangaLivre.length >= limiteSeguro;

  const traduzidas = await filtrarPorSequenciaValida(mescladas);

  return { traduzidas, semTraducao: doMangaDex.semTraducao, temMais };
}

export async function buscarObraPorId(idBruto: string): Promise<Obra | null> {
  const id = decodificarId(idBruto);
  if (ehIdMangaLivre(id)) {
    return buscarObraPorSlugMangaLivre(idParaSlugMangaLivre(id));
  }
  return buscarObraPorIdMangaDex(id);
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

  const mescladas = await mesclarPreferindoMaisCapitulos(
    doMangaDex.traduzidas,
    doMangaLivre
  );
  const traduzidas = await filtrarPorSequenciaValida(mescladas);

  return {
    traduzidas,
    semTraducao: doMangaDex.semTraducao,
  };
}
