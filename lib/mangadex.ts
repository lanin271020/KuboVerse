import { ObraSchema, CapituloSchema, type Obra, type Capitulo, type TipoObra } from "./types";

const MANGADEX_BASE_URL = "https://api.mangadex.org";

/**
 * Repository pattern: toda a lógica de acesso à MangaDex fica isolada aqui.
 * Se um dia trocarmos ou complementarmos a fonte (AniList/Jikan), só este
 * arquivo muda — os componentes e Route Handlers não sabem de onde os
 * dados vêm.
 */

// --- Tipos mínimos do payload cru da MangaDex (só os campos que usamos) ---
// Não é o schema completo da API — é o suficiente para tirar o `any` do
// mapeamento e pegar erros de digitação em tempo de desenvolvimento.

interface MangaDexLocalizedString {
  [idioma: string]: string;
}

interface MangaDexTag {
  attributes?: {
    group?: string;
    name?: MangaDexLocalizedString;
  };
}

interface MangaDexRelationship {
  type: string;
  attributes?: {
    name?: string;
    fileName?: string;
  };
}

interface MangaDexMangaAttributes {
  title?: MangaDexLocalizedString;
  // `title` costuma trazer só UMA chave — muitas vezes a romanização do
  // idioma original (ex.: "ko-ro") —, não o título "oficial" em pt-br/en.
  // Essas traduções ficam em `altTitles`, uma lista de objetos de uma
  // chave cada (ex.: [{ en: "Solo Leveling" }, { "pt-br": "Jogador solo" }]).
  altTitles?: MangaDexLocalizedString[];
  description?: MangaDexLocalizedString;
  status?: string;
  originalLanguage?: string;
  availableTranslatedLanguages?: string[];
  // shounen | seinen | shoujo | josei — demografia editorial da obra.
  publicationDemographic?: string;
  tags?: MangaDexTag[];
  contentRating?: string;
}

/**
 * Escolhe o melhor título disponível seguindo uma ordem de PREFERÊNCIA
 * DE IDIOMA (não de campo): para cada idioma da lista, checa primeiro
 * `title` e só then `altTitles` antes de passar para o próximo idioma.
 *
 * Isso é importante porque `title` costuma trazer só UMA chave — na
 * prática, quase sempre a romanização do idioma original OU o inglês —
 * enquanto uma tradução pt-br de verdade, quando existe, normalmente
 * mora em `altTitles`. Um bug real encontrado em produção: se a ordem
 * fosse "primeiro título principal em TODOS os idiomas, depois
 * altTitles em todos os idiomas" (como era antes), uma obra com
 * `title: { en: "..." }` e um pt-br só em `altTitles` (ex.: "Latna
 * Saga: Survival of a Sword King", que tem "Latna Saga: A Jornada do
 * Rei Espadachim" em altTitles) nunca chegava a usar o pt-br — o
 * `title.en` já "ganhava" antes de altTitles ser consultado.
 */
function buscarPrimeiroTitulo(
  title: MangaDexLocalizedString | undefined,
  altTitles: MangaDexLocalizedString[] | undefined,
  idiomas: string[]
): string | undefined {
  for (const idioma of idiomas) {
    if (title?.[idioma]) return title[idioma];
    for (const alt of altTitles ?? []) {
      if (alt[idioma]) return alt[idioma];
    }
  }
  return undefined;
}

/**
 * Classificações de conteúdo da MangaDex mantidas no catálogo. Só "safe"
 * — "suggestive" foi removida de propósito: é a classificação onde vive
 * a maior parte do ecchi/fanservice pesado (nudez não-sexual, insinuação
 * sexual explícita), então mantê-la deixaria passar exatamente o tipo de
 * conteúdo que a curadoria quer excluir. "erotica"/"pornographic" nunca
 * foram permitidas e continuam de fora.
 *
 * Filtramos por `contentRating[]=safe` já na query, mas também checamos
 * aqui de novo — em profundidade, não só na borda — para cobrir o caso de
 * uma obra ser aberta direto por id (`buscarObraPorId`), rota que não
 * aceita esse filtro por não ser uma busca em lista.
 */
const CLASSIFICACAO_PERMITIDA = "safe";

/**
 * Tags da MangaDex mantidas fora do catálogo mesmo quando a obra está
 * classificada como "safe"/"suggestive" — este é um site para crianças,
 * então a régua aqui é mais baixa que "só o proibido explicitamente".
 * Pelo mesmo motivo da restrição de `contentRating` acima:
 *
 * - "Sexual Violence": violência sexual.
 * - "Harem"/"Reverse Harem": na prática, quase toda obra com essa tag no
 *   catálogo (isekai/romance com múltiplas garotas/rapazes) carrega
 *   fanservice pesado na capa, mesmo quando a classificação oficial não
 *   denuncia isso (ver IDS_EXCLUIDOS_MANUALMENTE para casos sem
 *   NENHUMA tag reveladora) — curadoria decidiu excluir a tag inteira.
 * - "Loli"/"Shota": sexualização de personagens com aparência infantil,
 *   incompatível com um site para crianças independentemente da
 *   classificação de conteúdo da obra.
 *
 * Nota sobre exigência de bloquear "Erotica"/"Pornographic"/"Hentai"/
 * "Adult"/"Smut"/"Ecchi": conferido na lista completa de tags da
 * MangaDex (GET /manga/tag, 77 tags no total) — nenhuma dessas existe
 * como TAG na MangaDex; lá esse conceito é inteiramente coberto pelo
 * campo `contentRating` (ver CLASSIFICACAO_PERMITIDA acima, que já
 * exige "safe" e portanto exclui "suggestive"/"erotica"/"pornographic"
 * — onde "ecchi"/"hentai"/"adult"/"smut" vivem na taxonomia da
 * MangaDex). `REGEX_TEXTO_ADULTO` abaixo cobre esses termos como rede
 * de segurança adicional sobre título/sinopse, para o caso de a
 * classificação oficial estar errada.
 */
const TAGS_TEMA_EXCLUIDAS = new Set(["sexual violence", "harem", "reverse harem", "loli", "shota"]);

/**
 * Rede de segurança extra: mesmo com `contentRating`/tags "limpos", já
 * apareceu doujinshi/spinoff na MangaDex cuja própria sinopse (em
 * inglês) se autodescreve como conteúdo adulto (ex.: "this is an 'ero
 * spinoff'") sem nenhuma tag correspondente. Checamos título e sinopse
 * em TODOS os idiomas disponíveis (não só pt-br/en) por precaução.
 * `\bero\b` casa "ero" como palavra isolada (comum em gírias
 * japonesas/fandom pra "erótico") sem casar dentro de "hero"/"zero".
 *
 * Não inclui "adult" sozinho aqui de propósito: é uma palavra comum
 * demais em sinopses legítimas (ex.: "ela já é uma adulta") — o
 * conceito de conteúdo adulto já é coberto de forma confiável pelo
 * `contentRating` (MangaDex nem tem "Adult" como tag literal — ver
 * `TAGS_TEMA_EXCLUIDAS`/lista completa de tags checada manualmente).
 * "smut" entra aqui porque, ao contrário de "adult", é um termo raro
 * fora do contexto de conteúdo adulto.
 */
const REGEX_TEXTO_ADULTO = /\b(hentai|ecchi|erotic|erotica|ero|smut|nsfw|r-?18)\b/i;

// Exportada para reuso em lib/mangalivre.ts: a sinopse do MangaLivre não
// passava por nenhuma varredura de texto (só o título, com uma regex
// própria e mais focada em gírias em português) — assimetria em relação
// à MangaDex, onde título E sinopse sempre passam por esta mesma checagem.
export function algumTextoEhAdulto(textos: Array<string | undefined>): boolean {
  return textos.some((t) => t && REGEX_TEXTO_ADULTO.test(t));
}

/**
 * Checagem completa de conteúdo adulto para um payload de obra da
 * MangaDex — reúne as três camadas (`contentRating`, tags, texto) num
 * só lugar para que `mapParaObra` e `buscarSinalConfiavelPorTitulo`
 * (usada por outras fontes, ex.: MangaLivre, como segunda verificação)
 * aplicarem exatamente a mesma regra, sem duplicar/dessincronizar
 * lógica entre os dois usos.
 *
 * "Fail-closed" no `contentRating`: se vier ausente do payload (nunca
 * deveria, mas não custa não confiar cegamente), tratamos como NÃO
 * seguro em vez de deixar passar por omissão.
 */
function conteudoEhAdulto(attrs: MangaDexMangaAttributes): boolean {
  if (attrs.contentRating !== CLASSIFICACAO_PERMITIDA) {
    return true;
  }

  const temTagExcluida = (attrs.tags ?? []).some((t) =>
    TAGS_TEMA_EXCLUIDAS.has((t.attributes?.name?.en ?? "").toLowerCase())
  );
  if (temTagExcluida) {
    return true;
  }

  // Ver nota em REGEX_TEXTO_ADULTO — checagem por texto (título/sinopse
  // em qualquer idioma), não só por tag/classificação.
  return algumTextoEhAdulto([
    ...Object.values(attrs.title ?? {}),
    ...(attrs.altTitles ?? []).flatMap((alt) => Object.values(alt)),
    ...Object.values(attrs.description ?? {}),
  ]);
}

/**
 * Obras removidas manualmente por id, mesmo tendo passado pelos filtros
 * de `contentRating`/tags acima. Existe porque a classificação da
 * MangaDex é preenchida pela própria comunidade e às vezes erra: a capa
 * de uma obra (sobretudo adaptação de light novel) pode ter fanservice
 * pesado mesmo com a obra marcada como "safe", sem nenhuma tag que
 * denuncie isso — não há como detectar esse caso automaticamente sem
 * analisar a imagem da capa, o que este projeto não faz. Cada entrada
 * aqui foi conferida manualmente (capa vista diretamente).
 *
 * Chave: id da obra na MangaDex. Valor: só um comentário do motivo, pra
 * não virar uma lista de ids "misteriosos" no meio do código.
 */
const IDS_EXCLUIDOS_MANUALMENTE: Record<string, string> = {
  // "Kawaii Kanojo-chan" / "Uma Namorada Fofa" — marcada "safe" pela
  // MangaDex, mas a capa oficial (volume 3) tem fanservice incompatível
  // com a curadoria do catálogo.
  "b7e673cb-3890-484e-b4cc-05a467dc324a": "Kawaii Kanojo-chan — capa incompatível com a curadoria apesar da classificação safe",
  // "Comecei a trabalhar como empregado doméstico..." — mesmo padrão:
  // "safe", sem tag reveladora, capa incompatível com a curadoria.
  "ad75039d-686c-457f-b478-e56fc3b3c069": "Kaji Daikou no Arubaito... — capa incompatível com a curadoria apesar da classificação safe",
  // "Mieruko-chan" — marcada "safe", mas tem fanservice/conteúdo adulto
  // incompatível com a curadoria infantil do catálogo.
  "6670ee28-f26d-4b61-b49c-d71149cd5a6e": "Mieruko-chan — conteúdo adulto/fanservice incompatível com a curadoria apesar da classificação safe",
  "db35d742-8540-4f2f-bc6b-29623c6bbb61": "Mieruko-chan Official Anthology — mesma franquia, mesmo problema de curadoria",
  "e1a8bdd1-eea2-47cd-927e-0f7654c64c7c": "Mieruko-chan (Pre-Serialization) — mesma franquia, mesmo problema de curadoria",
};

/**
 * Remove links, URLs e propaganda (novels, redes sociais, doação) do
 * texto de uma sinopse, deixando só a narrativa da obra. As sinopses da
 * MangaDex costumam vir com esse tipo de "rodapé" adicionado por quem
 * traduziu/postou, que não faz parte da história em si.
 */
const REGEX_LINK_MARKDOWN = /\[([^\]]*)\]\(https?:\/\/[^)]+\)/gi;
const REGEX_URL_CRUA = /https?:\/\/\S+/gi;
const REGEX_LINHA_COM_SERVICO_PROMOCIONAL =
  /^.*\b(discord\.gg|patreon|ko-?fi|buymeacoffee|instagram\.com|twitter\.com|x\.com|facebook\.com|tiktok\.com|youtube\.com|youtu\.be|linktr\.ee|bit\.ly)\b.*$/gim;
const REGEX_LINHA_CHAMADA_PARA_NOVEL =
  /^.*\b(leia|ler|read|link)\b.*\b(novel|raw|webnovel|light novel)\b.*$/gim;
const REGEX_SEPARADOR_DECORATIVO = /^[ \t]*[-=_~*]{3,}[ \t]*$/gm;
// Sinopses da MangaDex costumam terminar com uma "tabela" markdown de
// links (ex.: raw/edição japonesa/inglesa) — depois que os links em si
// já foram removidos pelas regras acima, sobra só a pontuação da tabela
// (`|`, marcadores de lista/citação vazios). Prosa de sinopse não usa
// "|" de verdade, então qualquer linha com esse caractere é lixo de
// formatação, não parte da história.
const REGEX_LINHA_COM_PIPE = /^.*\|.*$/gm;
const REGEX_LINHA_MARCADOR_VAZIO = /^[ \t]*[-*>][ \t]*$/gm;
const REGEX_LINHAS_VAZIAS_EXTRAS = /\n{3,}/g;

function limparSinopse(bruta: string): string {
  if (!bruta) return "";

  const semLinksEPromo = bruta
    .replace(REGEX_LINK_MARKDOWN, "")
    .replace(REGEX_URL_CRUA, "")
    .replace(REGEX_LINHA_COM_PIPE, "")
    .replace(REGEX_LINHA_COM_SERVICO_PROMOCIONAL, "")
    .replace(REGEX_LINHA_CHAMADA_PARA_NOVEL, "")
    .replace(REGEX_SEPARADOR_DECORATIVO, "")
    .replace(REGEX_LINHA_MARCADOR_VAZIO, "");

  return semLinksEPromo
    .split("\n")
    .map((linha) => linha.trim())
    .join("\n")
    .replace(REGEX_LINHAS_VAZIAS_EXTRAS, "\n\n")
    .trim();
}

interface MangaDexMangaRaw {
  id: string;
  attributes?: MangaDexMangaAttributes;
  relationships?: MangaDexRelationship[];
}

interface MangaDexChapterRaw {
  attributes?: {
    publishAt?: string;
  };
}

interface MangaDexChapterListItemRaw {
  id: string;
  attributes?: {
    chapter?: string | null;
    title?: string | null;
    translatedLanguage?: string;
    publishAt?: string;
  };
}

/**
 * Erro que preserva o status HTTP da resposta da MangaDex, para que quem
 * chamar possa distinguir "recurso não existe" (404) de uma falha
 * temporária (timeout, erro de rede, 5xx) — são casos que merecem
 * tratamento diferente na UI.
 */
export class ErroRespostaMangaDex extends Error {
  constructor(public readonly status: number, url: string) {
    super(`MangaDex respondeu ${status} para ${url}`);
    this.name = "ErroRespostaMangaDex";
  }
}

function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Todo id de obra/capítulo real da MangaDex é um UUID — checar isso ANTES
 * de montar a URL da requisição evita dois problemas com ids vindos de
 * parâmetro de rota (portanto, controlados por quem acessa a URL, não
 * validados em nenhum outro lugar antes de chegar aqui): (1) uma chamada
 * de rede desnecessária para um id obviamente inválido, e (2) um id
 * contendo "/" ou "?" (ex.: decodificado de `%2F`) alterando o PATH da
 * URL montada por interpolação de string abaixo — a MangaDex é o único
 * host possível (URL fixa), mas o recurso pedido dentro dela poderia
 * escapar do endpoint esperado.
 */
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Número de novas tentativas em caso de 429 (rate limit) — além da
// tentativa original. Sem isso, um pico de chamadas (ex.: `executarEmLotes`
// processando várias obras) que tropeça no rate limit da MangaDex falhava
// a chamada inteira na hora, arriscando um bloqueio de IP mais severo se o
// código só reagisse tentando de novo imediatamente, sem nenhuma pausa.
const MAXIMO_TENTATIVAS_429 = 3;
const BACKOFF_BASE_MS = 1000;

async function fetchComTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  for (let tentativa = 0; ; tentativa++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.status === 429 && tentativa < MAXIMO_TENTATIVAS_429) {
        // A MangaDex costuma informar quanto esperar via `Retry-After`
        // (em segundos); na ausência dele, usamos backoff exponencial
        // (1s, 2s, 4s) como estimativa razoável.
        const retryAfterHeader = Number(res.headers.get("retry-after"));
        const esperaMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? retryAfterHeader * 1000
          : BACKOFF_BASE_MS * 2 ** tentativa;
        console.warn(`MangaDex respondeu 429 para ${url} — aguardando ${esperaMs}ms antes de tentar de novo (tentativa ${tentativa + 1}/${MAXIMO_TENTATIVAS_429}).`);
        await aguardar(esperaMs);
        continue;
      }
      if (!res.ok) {
        throw new ErroRespostaMangaDex(res.status, url);
      }
      return res;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Infere o tipo editorial a partir do PAÍS DE ORIGEM da obra — que a
 * MangaDex expõe via `originalLanguage`, preenchido pela própria
 * comunidade a partir da publicação original (não é "o idioma que a
 * obra tem disponível", é o idioma em que ela foi originalmente
 * publicada, ou seja, país de origem por proxy direto):
 * ko = coreano (manhwa), ja = japonês (mangá), zh/zh-hk = chinês (manhua).
 *
 * Quando o idioma não é nenhum desses (raro — metadados incompletos ou
 * uma obra de origem ocidental), NÃO assumimos silenciosamente "manga":
 * isso mascararia justamente o tipo de erro que a curadoria quer evitar
 * (uma obra classificada incorretamente sem deixar rastro). Em vez
 * disso, devolvemos "manga" como fallback só depois de registrar um
 * aviso, para que esses casos fiquem visíveis nos logs e possam ser
 * revisados manualmente se necessário.
 */
function inferirTipo(originalLanguage: string | undefined, contextoParaLog: string): TipoObra {
  switch (originalLanguage) {
    case "ko":
      return "manhwa";
    case "ja":
      return "manga";
    case "zh":
    case "zh-hk":
      return "manhua";
    default:
      console.warn(
        `Obra "${contextoParaLog}" tem originalLanguage="${originalLanguage}" — nenhum país de origem conhecido (ko/ja/zh/zh-hk). Classificando como "manga" por padrão, mas isso pode estar incorreto.`
      );
      return "manga";
  }
}

function normalizarTituloParaComparar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Sinal de segunda opinião da MangaDex sobre uma obra vinda de outra
 * fonte (ver uso em lib/mangalivre.ts): tipo editorial confiável (por
 * país de origem) e se a MESMA obra, pelos critérios da MangaDex,
 * seria considerada conteúdo adulto — mesmo quando a fonte original
 * (ex.: MangaLivre) não tem tag nenhuma que denuncie isso. Achado real
 * durante testes: "Regressão absoluta" tem tags "Action"/"Fantasy" só
 * no MangaLivre, mas a mesma obra é "suggestive" na MangaDex — sem
 * este cruzamento, essa obra passaria pelo filtro do MangaLivre sem
 * ser notada.
 */
export interface SinalConfiavelMangaDex {
  tipo: TipoObra;
  conteudoAdulto: boolean;
  /** true quando a MangaDex marca a obra como demografia shonen. */
  demograficoShonen: boolean;
  /**
   * true só para erotica/pornographic ou denylist manual — NÃO inclui
   * "suggestive" sozinho. Usado pelo MangaLivre: shonen de ação (ex.:
   * Jujutsu Kaisen) costuma ser "suggestive" na MangaDex sem ser o
   * fanservice/ecchi que a curadoria quer barrar nessa fonte.
   */
  bloqueioAdultoSevero: boolean;
}

/**
 * Busca o título na própria MangaDex e, se achar uma correspondência
 * de título exata (após normalização — sem acento/pontuação) entre
 * `titulo` e o título/algum altTitle da obra encontrada, devolve o
 * sinal confiável (tipo editorial + conteúdo adulto) dessa obra.
 *
 * Devolve `null` quando não encontra correspondência confiável — cabe
 * a quem chama decidir o fallback, para não mascarar silenciosamente
 * um caso sem resposta como se fosse uma obra confirmada segura/seu
 * tipo confirmado.
 */
export async function buscarSinalConfiavelPorTitulo(titulo: string): Promise<SinalConfiavelMangaDex | null> {
  const tituloNormalizado = normalizarTituloParaComparar(titulo);
  if (!tituloNormalizado) return null;

  const url = `${MANGADEX_BASE_URL}/manga?title=${encodeURIComponent(titulo)}&limit=5`;
  try {
    const res = await fetchComTimeout(url, 6000);
    const json = await res.json();
    const brutos: MangaDexMangaRaw[] = json.data ?? [];

    for (const raw of brutos) {
      const attrs = raw.attributes ?? {};
      const titulosCandidatos = [
        ...Object.values(attrs.title ?? {}),
        ...(attrs.altTitles ?? []).flatMap((alt) => Object.values(alt)),
      ];
      const bate = titulosCandidatos.some(
        (t) => normalizarTituloParaComparar(t) === tituloNormalizado
      );
      if (bate) {
        const tagsNome = (attrs.tags ?? [])
          .map((tag) => tag.attributes?.name?.en ?? "")
          .join(" ");
        const naDenylist = raw.id in IDS_EXCLUIDOS_MANUALMENTE;
        const rating = (attrs.contentRating ?? "").toLowerCase();
        return {
          tipo: inferirTipo(attrs.originalLanguage, titulo),
          // Denylist manual conta como adulto também na segunda opinião
          // (MangaLivre etc.) — senão a obra some da MangaDex e volta
          // pela outra fonte.
          conteudoAdulto: conteudoEhAdulto(attrs) || naDenylist,
          demograficoShonen:
            attrs.publicationDemographic === "shounen" ||
            /\bshou?nen\b/i.test(tagsNome),
          bloqueioAdultoSevero:
            naDenylist || rating === "erotica" || rating === "pornographic",
        };
      }
    }
    return null;
  } catch (err) {
    console.warn(`Falha ao consultar a MangaDex para segunda opinião sobre "${titulo}":`, err);
    return null;
  }
}

/**
 * Busca, para uma obra específica, a data de publicação do capítulo pt-BR
 * mais recente. Usado para o selo "novo" no card.
 */
async function buscarDataCapituloMaisRecentePtBr(mangaId: string): Promise<string | null> {
  const url = `${MANGADEX_BASE_URL}/chapter?manga=${mangaId}&translatedLanguage[]=pt-br&order[publishAt]=desc&limit=1`;
  try {
    const res = await fetchComTimeout(url, 5000);
    const json = await res.json();
    const capitulos: MangaDexChapterRaw[] = json.data ?? [];
    return capitulos[0]?.attributes?.publishAt ?? null;
  } catch (err) {
    // Não é um erro fatal: a obra continua aparecendo, só sem o selo "novo".
    console.warn(`Não foi possível buscar o capítulo mais recente pt-BR da obra ${mangaId}:`, err);
    return null;
  }
}

/**
 * Roda tarefas assíncronas em lotes, limitando a concorrência para não
 * estourar o rate limit da MangaDex quando processamos várias obras.
 * Exportado para reuso em lib/catalogo.ts (ex.: validar capítulos de
 * várias obras do catálogo sem disparar tudo de uma vez).
 */
export async function executarEmLotes<T, R>(
  itens: T[],
  tamanhoDoLote: number,
  tarefa: (item: T) => Promise<R>
): Promise<R[]> {
  const resultados: R[] = [];
  for (let i = 0; i < itens.length; i += tamanhoDoLote) {
    const lote = itens.slice(i, i + tamanhoDoLote);
    const resultadosDoLote = await Promise.all(lote.map(tarefa));
    resultados.push(...resultadosDoLote);
  }
  return resultados;
}

/**
 * Mapeia o payload cru da MangaDex para o formato interno (Obra),
 * validando com Zod antes de devolver. Retorna null se o payload
 * não bater com o schema esperado, em vez de derrubar a página —
 * mas registra o motivo, para não falhar em silêncio.
 */
function mapParaObra(
  raw: MangaDexMangaRaw,
  temTraducaoPtBr: boolean,
  capituloMaisRecentePtBr: string | null
): Obra | null {
  const attrs = raw.attributes ?? {};

  // Exclusão manual por id — ver nota em IDS_EXCLUIDOS_MANUALMENTE.
  // Checada antes de tudo: independe de contentRating/tags, é por isso
  // que existe.
  if (raw.id in IDS_EXCLUIDOS_MANUALMENTE) {
    return null;
  }

  // Filtro obrigatório de conteúdo adulto/ecchi — ver `conteudoEhAdulto`
  // (compartilhada com `buscarSinalConfiavelPorTitulo`, usada como
  // segunda camada de verificação para outras fontes, ex.: MangaLivre).
  if (conteudoEhAdulto(attrs)) {
    return null;
  }

  try {
    const capaRel = raw.relationships?.find((r) => r.type === "cover_art");
    const autorRel = raw.relationships?.find((r) => r.type === "author");

    if (capaRel && !capaRel.attributes?.fileName) {
      console.warn(`Obra ${raw.id} tem relationship de capa sem fileName — exibindo sem capa.`);
    }

    // Título: pt-BR primeiro, depois pt (português de Portugal — ainda
    // muito mais legível para o público daqui que inglês/romanização),
    // depois inglês — ver `buscarPrimeiroTitulo` sobre por que a ordem
    // de busca é POR IDIOMA (não por campo `title`/`altTitles`). Só
    // como último recurso usamos o nome no idioma original da obra (não
    // romanizado); nunca uma romanização (ex.: "ko-ro"/"ja-ro") — é
    // exatamente o tipo de título "confuso" que queremos evitar quando
    // há tradução real.
    const tituloOriginal = attrs.originalLanguage ? attrs.title?.[attrs.originalLanguage] : undefined;
    const titulo =
      buscarPrimeiroTitulo(attrs.title, attrs.altTitles, ["pt-br", "pt", "en"]) ??
      tituloOriginal ??
      "Sem título";

    const sinopseBruta = attrs.description?.["pt-br"] ?? attrs.description?.en ?? "";

    const candidato = {
      id: raw.id,
      titulo,
      autor: autorRel?.attributes?.name ?? null,
      status: attrs.status ?? "desconhecido",
      // Inclui tags de "genre" e "theme" (ex.: Isekai é theme, não genre,
      // na taxonomia da MangaDex) — para o filtro de categoria do
      // catálogo funcionar com os rótulos que o usuário reconhece.
      generos: (attrs.tags ?? [])
        .filter((t) => t.attributes?.group === "genre" || t.attributes?.group === "theme")
        .map((t) => t.attributes?.name?.["pt-br"] ?? t.attributes?.name?.en ?? "")
        .filter((nome) => nome !== ""),
      sinopse: limparSinopse(sinopseBruta),
      capa:
        capaRel?.attributes?.fileName
          ? `https://uploads.mangadex.org/covers/${raw.id}/${capaRel.attributes.fileName}`
          : null,
      tipo: inferirTipo(attrs.originalLanguage, titulo),
      temTraducaoPtBr,
      capituloMaisRecentePtBr,
    };

    return ObraSchema.parse(candidato);
  } catch (err) {
    console.error(`Obra ${raw.id ?? "id desconhecido"} descartada — payload fora do schema esperado:`, err);
    return null;
  }
}

/**
 * Busca obras populares e as separa em duas listas: com tradução pt-BR
 * e sem tradução. Essa separação acontece aqui, na camada de dados —
 * nunca no client.
 *
 * Para as obras com tradução pt-BR, busca também a data do capítulo mais
 * recente (em lotes, para não estourar o rate limit da MangaDex).
 *
 * `offset`/`limit` permitem paginação ("carregar mais" no catálogo).
 * `temMais` é uma heurística: se a página veio cheia (tamanho === limit),
 * assumimos que provavelmente há mais itens — a MangaDex não devolve um
 * total exato de forma barata, então isso pode ocasionalmente mostrar um
 * botão "carregar mais" numa última página que já está vazia; nesse caso
 * o próximo clique simplesmente retorna uma lista vazia sem erro.
 *
 * A query já filtra na fonte por `availableTranslatedLanguage[]=pt-br` —
 * o catálogo principal só deve mostrar obras com tradução real em
 * português — e por `contentRating[]=safe`, excluindo "suggestive"
 * (ecchi/fanservice pesado), "erotica" e "pornographic" (filtro
 * obrigatório, ver CLASSIFICACAO_PERMITIDA). Como consequência,
 * `semTraducao` tende a vir sempre vazia por este caminho; a função
 * continua devolvendo os dois campos para não quebrar quem consome
 * (`/sem-traducao`), mas esse bucket só se popula de fato onde o filtro
 * de idioma não é aplicado.
 */
export async function buscarCatalogo(
  offset: number = 0,
  limit: number = 20
): Promise<{ traduzidas: Obra[]; semTraducao: Obra[]; temMais: boolean }> {
  const url =
    `${MANGADEX_BASE_URL}/manga?limit=${limit}&offset=${offset}` +
    `&order[followedCount]=desc` +
    `&availableTranslatedLanguage[]=pt-br` +
    `&contentRating[]=${CLASSIFICACAO_PERMITIDA}` +
    `&includes[]=cover_art&includes[]=author`;
  const res = await fetchComTimeout(url);
  const json = await res.json();
  const brutos: MangaDexMangaRaw[] = json.data ?? [];

  const comSinalPtBr = brutos.map((raw) => ({
    raw,
    temPtBr: (raw.attributes?.availableTranslatedLanguages ?? []).includes("pt-br"),
  }));

  // Busca a data do capítulo mais recente só para quem tem pt-BR,
  // em lotes de 5 para respeitar o rate limit da MangaDex.
  const comData = await executarEmLotes(comSinalPtBr, 5, async ({ raw, temPtBr }) => ({
    raw,
    temPtBr,
    dataMaisRecente: temPtBr ? await buscarDataCapituloMaisRecentePtBr(raw.id) : null,
  }));

  const traduzidas: Obra[] = [];
  const semTraducao: Obra[] = [];
  let descartadas = 0;

  for (const { raw, temPtBr, dataMaisRecente } of comData) {
    const obra = mapParaObra(raw, temPtBr, dataMaisRecente);
    if (!obra) {
      descartadas++;
      continue;
    }
    (temPtBr ? traduzidas : semTraducao).push(obra);
  }

  if (descartadas > 0) {
    console.warn(`${descartadas} de ${brutos.length} obras foram descartadas por payload inválido.`);
  }

  return { traduzidas, semTraducao, temMais: brutos.length === limit };
}

/**
 * Busca uma obra por id.
 *
 * Contrato de erro (diferente das outras funções deste arquivo, que sempre
 * engolem erro e devolvem um valor vazio): aqui a distinção importa para a
 * UI, então:
 * - 404 da MangaDex → devolve `null` (a obra genuinamente não existe;
 *   quem chama deve tratar isso como "página não encontrada").
 * - Qualquer outro erro (timeout, rede, 5xx) → PROPAGA a exceção. Quem
 *   chama precisa envolver esta função em try/catch e mostrar um estado
 *   de "tente novamente", não um 404 — a obra pode muito bem existir,
 *   só não conseguimos confirmar agora.
 */
export async function buscarObraPorId(id: string): Promise<Obra | null> {
  if (!REGEX_UUID.test(id)) return null;

  const url = `${MANGADEX_BASE_URL}/manga/${id}?includes[]=cover_art&includes[]=author`;

  let json: { data: MangaDexMangaRaw };
  try {
    const res = await fetchComTimeout(url);
    json = await res.json();
  } catch (err) {
    if (err instanceof ErroRespostaMangaDex && err.status === 404) {
      return null;
    }
    console.error(`Falha ao buscar a obra ${id} (não é um 404 — pode ser temporário):`, err);
    throw err;
  }

  const raw = json.data;
  const temPtBr = (raw?.attributes?.availableTranslatedLanguages ?? []).includes("pt-br");
  const dataMaisRecente = temPtBr ? await buscarDataCapituloMaisRecentePtBr(id) : null;

  return mapParaObra(raw, temPtBr, dataMaisRecente);
}

/**
 * Busca obras por título e separa em traduzidas/sem tradução, seguindo
 * a mesma regra de negócio do catálogo. Não busca a data do capítulo
 * mais recente (usada só para o selo "novo") para manter a busca rápida
 * — é uma troca deliberada de completude por velocidade percebida.
 */
export async function buscarPorTitulo(
  query: string
): Promise<{ traduzidas: Obra[]; semTraducao: Obra[] }> {
  const url =
    `${MANGADEX_BASE_URL}/manga?title=${encodeURIComponent(query)}&limit=15` +
    `&contentRating[]=${CLASSIFICACAO_PERMITIDA}` +
    `&includes[]=cover_art&includes[]=author`;

  let brutos: MangaDexMangaRaw[];
  try {
    const res = await fetchComTimeout(url, 6000);
    const json = await res.json();
    brutos = json.data ?? [];
  } catch (err) {
    console.error(`Falha ao buscar obras pelo título "${query}":`, err);
    return { traduzidas: [], semTraducao: [] };
  }

  const traduzidas: Obra[] = [];
  const semTraducao: Obra[] = [];

  for (const raw of brutos) {
    const temPtBr = (raw.attributes?.availableTranslatedLanguages ?? []).includes("pt-br");
    const obra = mapParaObra(raw, temPtBr, null);
    if (!obra) continue;
    (temPtBr ? traduzidas : semTraducao).push(obra);
  }

  return { traduzidas, semTraducao };
}

/**
 * Busca todos os capítulos em pt-BR de uma obra, ordenados do primeiro
 * para o último (ordem de leitura), paginando automaticamente pelo
 * limite de 100 capítulos por página da MangaDex.
 *
 * Limite técnico deliberado: para até `MAXIMO_DE_PAGINAS * LIMITE_POR_PAGINA`
 * capítulos (hoje, 500). Isso evita um loop de chamadas sem fim contra a
 * API em casos extremos; obras acima disso mostram um aviso no log em
 * vez de falhar em silêncio.
 */
export async function buscarCapitulosDaObra(mangaId: string): Promise<Capitulo[]> {
  if (!REGEX_UUID.test(mangaId)) return [];

  const LIMITE_POR_PAGINA = 100;
  const MAXIMO_DE_PAGINAS = 5;

  const capitulos: Capitulo[] = [];
  let descartados = 0;

  for (let pagina = 0; pagina < MAXIMO_DE_PAGINAS; pagina++) {
    const offset = pagina * LIMITE_POR_PAGINA;
    const url = `${MANGADEX_BASE_URL}/chapter?manga=${mangaId}&translatedLanguage[]=pt-br&order[chapter]=asc&limit=${LIMITE_POR_PAGINA}&offset=${offset}`;

    let brutos: MangaDexChapterListItemRaw[];
    try {
      const res = await fetchComTimeout(url);
      const json = await res.json();
      brutos = json.data ?? [];
    } catch (err) {
      console.error(`Falha ao buscar página ${pagina + 1} de capítulos da obra ${mangaId}:`, err);
      break; // devolve o que já foi coletado até aqui, em vez de perder tudo
    }

    for (const raw of brutos) {
      try {
        capitulos.push(
          CapituloSchema.parse({
            id: raw.id,
            numero: raw.attributes?.chapter ?? "?",
            titulo: raw.attributes?.title ?? null,
            idioma: raw.attributes?.translatedLanguage ?? "pt-br",
            publicadoEm: raw.attributes?.publishAt ?? "",
          })
        );
      } catch (err) {
        descartados++;
        console.warn(`Capítulo ${raw.id} da obra ${mangaId} descartado — payload inválido:`, err);
      }
    }

    if (brutos.length < LIMITE_POR_PAGINA) {
      break; // essa foi a última página
    }

    if (pagina === MAXIMO_DE_PAGINAS - 1) {
      console.warn(
        `Obra ${mangaId} atingiu o limite técnico de ${MAXIMO_DE_PAGINAS * LIMITE_POR_PAGINA} capítulos pt-BR — a lista pode estar incompleta.`
      );
    }
  }

  if (descartados > 0) {
    console.warn(`${descartados} capítulos da obra ${mangaId} foram descartados por payload inválido.`);
  }

  return capitulos;
}

interface MangaDexAtHomeResponse {
  baseUrl?: string;
  chapter?: {
    hash?: string;
    data?: string[];
    dataSaver?: string[];
  };
}

/**
 * Páginas de um capítulo em duas qualidades: `data` (alta resolução, como
 * publicado) e `dataSaver` (comprimida pelo próprio MangaDex@Home — bem
 * mais leve para conexões móveis). Os dois arrays têm o mesmo tamanho e
 * mantêm a correspondência por índice (página N em `data` é a mesma
 * página N em `dataSaver`, só que mais leve).
 */
export interface PaginasDoCapitulo {
  data: string[];
  dataSaver: string[];
}

const PAGINAS_VAZIAS: PaginasDoCapitulo = { data: [], dataSaver: [] };

/**
 * Busca as URLs das páginas de um capítulo via endpoint /at-home/server,
 * nas duas qualidades disponíveis (ver `PaginasDoCapitulo`).
 *
 * Importante: o `baseUrl` retornado aponta para um nó da rede
 * MangaDex@Home escolhido dinamicamente a cada chamada, com um token de
 * curta duração embutido — não é um domínio fixo, e o token expira. Por
 * isso as imagens do leitor usam <img> comum em vez de `next/image`: o
 * componente de otimização de imagem do Next exige uma lista fixa de
 * domínios liberados (`next.config.js`), o que não é compatível com um
 * host que muda a cada requisição. É também por isso que esta função
 * pode — e deve — ser chamada de novo (via a rota
 * `/api/capitulo/[capituloId]/paginas`) quando o token expira no meio de
 * uma leitura: cada chamada nova devolve um `baseUrl`/token frescos para
 * o mesmo capítulo, com os mesmos arquivos na mesma ordem.
 *
 * Contrato de erro (mesmo espírito de `buscarObraPorId`): um 404 real da
 * MangaDex (capítulo não existe/foi removido) devolve páginas vazias —
 * quem chama trata isso como "não encontrado". Qualquer outro erro
 * (timeout, rede, 5xx) PROPAGA a exceção — antes desta correção a função
 * engolia TODO erro e devolvia páginas vazias sempre, o que fazia o leitor
 * mostrar "capítulo não encontrado" (um 404 de fato) exatamente igual a
 * uma falha temporária de rede, quando os dois merecem mensagens
 * diferentes ("tente novamente" vs. "isso não existe").
 */
export async function buscarPaginasDoCapitulo(chapterId: string): Promise<PaginasDoCapitulo> {
  if (!REGEX_UUID.test(chapterId)) return PAGINAS_VAZIAS;

  const url = `${MANGADEX_BASE_URL}/at-home/server/${chapterId}`;

  let json: MangaDexAtHomeResponse;
  try {
    const res = await fetchComTimeout(url, 10000);
    json = await res.json();
  } catch (err) {
    if (err instanceof ErroRespostaMangaDex && err.status === 404) {
      return PAGINAS_VAZIAS;
    }
    console.error(`Falha ao buscar páginas do capítulo ${chapterId} (não é um 404 — pode ser temporário):`, err);
    throw err;
  }

  if (!json.baseUrl || !json.chapter?.hash || !Array.isArray(json.chapter.data)) {
    console.warn(`Resposta de /at-home/server fora do formato esperado para o capítulo ${chapterId}.`);
    return PAGINAS_VAZIAS;
  }

  const { baseUrl, chapter } = json;
  const montarUrls = (arquivos: string[] | undefined, pasta: "data" | "data-saver") =>
    (arquivos ?? []).map((nomeArquivo) => `${baseUrl}/${pasta}/${chapter.hash}/${nomeArquivo}`);

  return {
    data: montarUrls(chapter.data, "data"),
    // Nem toda resposta traz dataSaver preenchido (raro); nesse caso o
    // leitor cai de volta para a alta qualidade — ver LeitorCapitulo.
    dataSaver: montarUrls(chapter.dataSaver, "data-saver"),
  };
}
