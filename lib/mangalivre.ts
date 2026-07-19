import { ObraSchema, CapituloSchema, type Obra, type Capitulo, type TipoObra } from "./types";
import {
  executarEmLotes,
  buscarSinalConfiavelPorTitulo,
  algumTextoEhAdulto,
  type PaginasDoCapitulo,
} from "./mangadex";

const MANGALIVRE_BASE_URL = "https://mangalivre.blog";

/**
 * Segunda fonte de dados, complementar à MangaDex — um site brasileiro
 * de leitura (WordPress/tema "Madara"-like), sem API oficial. Diferente
 * da MangaDex, aqui extraímos os dados direto do HTML publicado (regex
 * sobre marcação estável do tema), porque não existe um endpoint JSON.
 *
 * Todo id de obra/capítulo desta fonte carrega o prefixo `ml:` — é como
 * `lib/catalogo.ts` decide para qual fonte rotear cada chamada. Nunca
 * remova esse prefixo sem atualizar `ehIdMangaLivre`/`idParaSlugMangaLivre`
 * também.
 */
const PREFIXO_MANGALIVRE = "ml:";

export function ehIdMangaLivre(id: string): boolean {
  return id.startsWith(PREFIXO_MANGALIVRE);
}

export function idParaSlugMangaLivre(id: string): string {
  return id.slice(PREFIXO_MANGALIVRE.length);
}

function slugParaIdMangaLivre(slug: string): string {
  return `${PREFIXO_MANGALIVRE}${slug}`;
}

/**
 * Filtro obrigatório de conteúdo adulto/ecchi — mesma exigência aplicada
 * à MangaDex (ver CLASSIFICACAO_PERMITIDA em lib/mangadex.ts), mas aqui
 * não há um campo `contentRating` estruturado, então checamos por tags e
 * por palavras explícitas no próprio título (rede de segurança extra,
 * já que o card de catálogo nem sempre expõe as tags da obra). Inclui
 * "ecchi"/"fanservice" além dos termos já explicitamente eróticos —
 * curadoria decidiu excluir também esse conteúdo, não só o pornográfico.
 * "Sexual Violence", "Harem"/"Reverse Harem" e "Loli"/"Shota" espelham
 * TAGS_TEMA_EXCLUIDAS em lib/mangadex.ts — mesmo raciocínio: este é um
 * site para crianças, então a régua é mais baixa que "só o proibido
 * explicitamente", e a tag "Harem" sozinha já é um forte indício de
 * fanservice pesado na capa, mesmo sem nenhuma outra tag reveladora.
 */
const TAGS_ADULTAS = new Set([
  "hentai",
  "adult",
  "adulto",
  "smut",
  "erotic",
  "erótico",
  "erotico",
  "erotica",
  "erótica",
  "pornographic",
  "18+",
  "ecchi",
  "fanservice",
  "fan service",
  "sexual violence",
  "harem",
  "reverse harem",
  "loli",
  "shota",
]);
const REGEX_TITULO_ADULTO = /\b(hentai|sexo|sexual|nude|nudez|xxx|porn[oôõ]?|ecchi)\b/i;

const TRADUCAO_GENEROS: Record<string, string> = {
  action: "Ação",
  adventure: "Aventura",
  comedy: "Comédia",
  drama: "Drama",
  fantasy: "Fantasia",
  romance: "Romance",
  "school life": "Vida Escolar",
  "sci-fi": "Ficção Científica",
  "science fiction": "Ficção Científica",
  "slice of life": "Slice of Life",
  supernatural: "Sobrenatural",
  horror: "Terror",
  mystery: "Mistério",
  psychological: "Psicológico",
  "martial arts": "Artes Marciais",
  shounen: "Shounen",
  seinen: "Seinen",
  shoujo: "Shoujo",
  josei: "Josei",
  tragedy: "Tragédia",
  historical: "Histórico",
  sports: "Esportes",
  isekai: "Isekai",
  reincarnation: "Reencarnação",
  harem: "Harem",
  magic: "Magia",
  military: "Militar",
  "super power": "Superpoderes",
  game: "Game",
  mecha: "Mecha",
  vampire: "Vampiro",
  zombies: "Zumbi",
  demons: "Demônios",
  webtoon: "Webtoon",
};

function decodificarEntidadesHtml(texto: string): string {
  return texto
    .replace(/&#(\d+);/g, (_, codigo: string) => String.fromCharCode(Number(codigo)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extrairTextoSemHtml(html: string): string {
  return decodificarEntidadesHtml(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * "há 2 semanas" → data ISO aproximada. O tema só expõe datas relativas
 * na listagem de capítulos, então isto é uma estimativa (o suficiente
 * para o selo "novo" do card, que já tolera alguma imprecisão).
 */
const UNIDADES_MS: Record<string, number> = {
  segundo: 1_000,
  segundos: 1_000,
  minuto: 60_000,
  minutos: 60_000,
  hora: 3_600_000,
  horas: 3_600_000,
  dia: 86_400_000,
  dias: 86_400_000,
  semana: 604_800_000,
  semanas: 604_800_000,
  mes: 2_592_000_000,
  meses: 2_592_000_000,
  ano: 31_536_000_000,
  anos: 31_536_000_000,
};

function relativoParaISO(texto: string): string | null {
  if (/agora|poucos segundos/i.test(texto)) return new Date().toISOString();
  const m = texto.match(/(\d+)\s+([a-zà-ú]+)/i);
  if (!m) return null;
  const valor = Number(m[1] ?? "");
  const unidade = normalizarTexto(m[2] ?? "");
  const ms = UNIDADES_MS[unidade];
  if (!ms || !Number.isFinite(valor)) return null;
  return new Date(Date.now() - valor * ms).toISOString();
}

function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mesmo raciocínio de MAXIMO_TENTATIVAS_429 em lib/mangadex.ts: evita que
// um pico de chamadas (catálogo/busca abrindo várias páginas de obra em
// lote) derrube a chamada inteira na primeira resposta 429, arriscando
// escalar para um bloqueio de IP mais severo.
const MAXIMO_TENTATIVAS_429 = 3;
const BACKOFF_BASE_MS = 1000;

// O MangaLivre fica atrás do Cloudflare e costuma devolver 403 para IPs
// de datacenter (Vercel). Depois do primeiro 403, pausamos as tentativas
// nesta instância por um tempo — senão o sitemap/catálogo spamam o mesmo
// erro a cada obra/página e gastam tempo de serverless à toa.
const BLOQUEIO_APOS_403_MS = 15 * 60 * 1000;
let mangaLivreBloqueadoAteMs = 0;
let avisoBloqueio403JaEmitido = false;

class MangaLivreIndisponivelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MangaLivreIndisponivelError";
  }
}

/**
 * Headers de navegador “cheios” o bastante para o Cloudflare não rejeitar
 * só por fingerprint mínimo. Não contorna bloqueio de IP de datacenter —
 * para isso use `MANGALIVRE_PROXY_URL` (ver .env.example).
 */
const HEADERS_MANGALIVRE: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  Referer: `${MANGALIVRE_BASE_URL}/`,
};

/**
 * Opcional: URL de um proxy (ex.: Cloudflare Worker) que recebe
 * `?url=<destino>` e devolve o HTML. Sem isso, na Vercel o MangaLivre
 * tende a falhar com 403 e o catálogo segue só com a MangaDex.
 */
function urlParaFetch(url: string): string {
  const proxy = process.env.MANGALIVRE_PROXY_URL?.trim();
  if (!proxy) return url;
  const base = proxy.replace(/\/$/, "");
  return `${base}?url=${encodeURIComponent(url)}`;
}

function headersParaFetch(): HeadersInit {
  const secret = process.env.MANGALIVRE_PROXY_SECRET?.trim();
  if (!secret || !process.env.MANGALIVRE_PROXY_URL?.trim()) {
    return HEADERS_MANGALIVRE;
  }
  return { ...HEADERS_MANGALIVRE, "X-Proxy-Secret": secret };
}

function logFalhaMangaLivre(contexto: string, err: unknown): void {
  if (err instanceof MangaLivreIndisponivelError) return;
  console.warn(contexto, err);
}

function marcarBloqueio403(url: string): never {
  mangaLivreBloqueadoAteMs = Date.now() + BLOQUEIO_APOS_403_MS;
  if (!avisoBloqueio403JaEmitido) {
    avisoBloqueio403JaEmitido = true;
    console.warn(
      `MangaLivre bloqueou o servidor com 403 (Cloudflare) em ${url}. ` +
        `Catálogo segue só com MangaDex pelos próximos ${BLOQUEIO_APOS_403_MS / 60_000} min. ` +
        `Para reativar na Vercel, configure MANGALIVRE_PROXY_URL.`
    );
  }
  throw new MangaLivreIndisponivelError(`MangaLivre respondeu 403 para ${url}`);
}

async function fetchHtmlComTimeout(url: string, timeoutMs = 10000): Promise<string> {
  if (Date.now() < mangaLivreBloqueadoAteMs) {
    throw new MangaLivreIndisponivelError(
      "MangaLivre temporariamente desativado após 403 (Cloudflare)."
    );
  }

  const urlFetch = urlParaFetch(url);

  for (let tentativa = 0; ; tentativa++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(urlFetch, {
        signal: controller.signal,
        headers: headersParaFetch(),
        // Não cachear página de desafio/403 do Cloudflare como se fosse HTML útil.
        cache: "no-store",
      });
      if (res.status === 403) {
        marcarBloqueio403(url);
      }
      if (res.status === 429 && tentativa < MAXIMO_TENTATIVAS_429) {
        const retryAfterHeader = Number(res.headers.get("retry-after"));
        const esperaMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? retryAfterHeader * 1000
          : BACKOFF_BASE_MS * 2 ** tentativa;
        console.warn(`MangaLivre respondeu 429 para ${url} — aguardando ${esperaMs}ms antes de tentar de novo (tentativa ${tentativa + 1}/${MAXIMO_TENTATIVAS_429}).`);
        await aguardar(esperaMs);
        continue;
      }
      if (!res.ok) {
        throw new Error(`MangaLivre respondeu ${res.status} para ${url}`);
      }
      const html = await res.text();
      // Desafio JS do Cloudflare às vezes vem como 200 com corpo de challenge.
      if (/just a moment|cf-browser-verification|__cf_chl/i.test(html)) {
        marcarBloqueio403(url);
      }
      // Sucesso real — libera o circuit breaker se um proxy passou a funcionar.
      mangaLivreBloqueadoAteMs = 0;
      avisoBloqueio403JaEmitido = false;
      return html;
    } finally {
      clearTimeout(timeout);
    }
  }
}

// Todo slug real do MangaLivre (obra ou capítulo) é só letras/números/
// hífen — o formato de URL "amigável" do WordPress. `slug`/`chapterSlug`
// nas funções abaixo vêm, em última instância, de um parâmetro de rota
// (via `idParaSlugMangaLivre`, depois de remover o prefixo "ml:") —
// portanto controlados por quem acessa a URL. Validar o formato ANTES
// de montar a URL da requisição evita que um valor com "/", "?" ou ".."
// altere o path pretendido (`/manga/<slug>/`, `/capitulo/<slug>/`) para
// outra página do mesmo site — mesmo raciocínio do REGEX_UUID em
// lib/mangadex.ts, adaptado ao formato de id desta fonte.
const REGEX_SLUG_VALIDO = /^[a-z0-9-]+$/i;

function extrairSlugDaUrlDeObra(url: string): string | null {
  const m = url.match(/\/manga\/([^/]+)\/?$/);
  return m?.[1] ?? null;
}

function extrairSlugDaUrlDeCapitulo(url: string): string | null {
  const m = url.match(/\/capitulo\/([^/]+)\/?$/);
  return m?.[1] ?? null;
}

interface CardCatalogoMangaLivre {
  slug: string;
  titulo: string;
  capa: string | null;
}

/**
 * Extrai os cards `<article class="manga-card-modern">` da listagem
 * (catálogo e resultado de busca usam a mesma marcação). Regex em vez
 * de um parser de HTML de verdade: não há dependência nova instalada
 * ainda e a marcação do tema é estável o suficiente para isso.
 */
function extrairCardsDoCatalogo(html: string): CardCatalogoMangaLivre[] {
  const cards: CardCatalogoMangaLivre[] = [];
  const regexCard = /<article class="manga-card-modern">([\s\S]*?)<\/article>/g;
  let m: RegExpExecArray | null;
  while ((m = regexCard.exec(html)) !== null) {
    const bloco = m[1] ?? "";
    const hrefMatch = bloco.match(/<a\s+href="([^"]+)"\s+class="manga-cover-link"/);
    const capaMatch = bloco.match(/<img[^>]+src="([^"]+)"[^>]*class="[^"]*attachment-manga-cover/);
    const tituloMatch = bloco.match(/<h3 class="manga-title-modern"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/);
    if (!hrefMatch || !tituloMatch) continue;

    const slug = extrairSlugDaUrlDeObra(hrefMatch[1] ?? "");
    if (!slug) continue;

    cards.push({
      slug,
      titulo: decodificarEntidadesHtml((tituloMatch[1] ?? "").trim()),
      capa: capaMatch?.[1] ?? null,
    });
  }
  return cards;
}

/**
 * Busca os cards de uma página do catálogo geral (`/manga/page/N/`),
 * já descartando por título óbvio (ver REGEX_TITULO_ADULTO). `pagina` é
 * 1-based, como a paginação do próprio site.
 *
 * Isto é intencionalmente "leve" — sem checar tags — porque a listagem
 * não expõe gêneros (só a página da obra tem esse detalhe). Por isso
 * NUNCA deve ser exposta diretamente como catálogo final: quem chama
 * precisa passar o resultado por `buscarObraPorSlugMangaLivre` (ver
 * `buscarCatalogoMangaLivre` abaixo) antes de mostrar ao usuário, para
 * aplicar o filtro completo de conteúdo adulto/ecchi (TAGS_ADULTAS).
 */
async function buscarCardsCatalogoMangaLivre(pagina: number, limite: number): Promise<CardCatalogoMangaLivre[]> {
  const url =
    pagina <= 1 ? `${MANGALIVRE_BASE_URL}/manga/` : `${MANGALIVRE_BASE_URL}/manga/page/${pagina}/`;

  try {
    const html = await fetchHtmlComTimeout(url);
    return extrairCardsDoCatalogo(html)
      .filter((card) => !REGEX_TITULO_ADULTO.test(card.titulo))
      .slice(0, limite);
  } catch (err) {
    logFalhaMangaLivre(`Falha ao buscar catálogo do MangaLivre (página ${pagina}):`, err);
    return [];
  }
}

/**
 * Busca uma página do catálogo geral já com o filtro COMPLETO de
 * conteúdo adulto/ecchi aplicado (tags reais da página de cada obra —
 * ver TAGS_ADULTAS —, não só o título). Obras do nicho "harem isekai"
 * costumam se disfarçar de fantasia/aventura no título e só denunciam o
 * conteúdo nas tags da própria página (ex.: "Sexual Violence"), então
 * checar apenas o card da listagem (como antes) deixava esse tipo de
 * obra passar.
 *
 * Busca a página de detalhe de cada card em lotes de 5 (mesma técnica
 * de `executarEmLotes` usada em lib/mangadex.ts) — mais lento que só ler
 * a listagem, mas é o preço da curadoria correta; catálogo menor porém
 * organizado é preferível a um catálogo maior mas com material adulto.
 */
export async function buscarCatalogoMangaLivre(pagina: number, limite: number): Promise<Obra[]> {
  const cards = await buscarCardsCatalogoMangaLivre(pagina, limite);
  const obras = await executarEmLotes(cards, 5, (card) =>
    buscarObraPorSlugMangaLivre(card.slug).catch((err) => {
      logFalhaMangaLivre(
        `Falha ao verificar conteúdo da obra MangaLivre "${card.slug}" no catálogo:`,
        err
      );
      return null;
    })
  );
  return obras.filter((obra): obra is Obra => obra !== null);
}

/**
 * O site não tem uma busca server-rendered simples de raspar (a busca
 * padrão do WordPress não devolve os cards de manga na página de
 * resultado). Como substituto, filtramos por título dentro de algumas
 * páginas do catálogo geral — cobertura parcial, mas funcional sem
 * depender de um endpoint que não conseguimos confirmar.
 *
 * O casamento de título usa só os cards (leve, sem tags) para não pagar
 * o custo de abrir a página de cada obra do catálogo geral — só as que
 * batem com a busca passam pela verificação completa de conteúdo
 * (mesma checagem de `buscarCatalogoMangaLivre`), o que mantém a busca
 * rápida sem abrir mão da curadoria.
 */
export async function buscarPorTituloMangaLivre(query: string, maxPaginas = 3): Promise<Obra[]> {
  const queryNormalizada = normalizarTexto(query);
  if (!queryNormalizada) return [];

  const candidatos: CardCatalogoMangaLivre[] = [];
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const cards = await buscarCardsCatalogoMangaLivre(pagina, 20);
    if (cards.length === 0) break;
    candidatos.push(...cards.filter((c) => normalizarTexto(c.titulo).includes(queryNormalizada)));
  }

  const obras = await executarEmLotes(candidatos, 5, (card) =>
    buscarObraPorSlugMangaLivre(card.slug).catch((err) => {
      logFalhaMangaLivre(
        `Falha ao verificar conteúdo da obra MangaLivre "${card.slug}" na busca:`,
        err
      );
      return null;
    })
  );
  return obras.filter((obra): obra is Obra => obra !== null);
}

function extrairValorMeta(html: string, rotulo: string): string | null {
  const regex = new RegExp(`<span class="meta-label">${rotulo}:<\\/span>\\s*<span class="meta-value">([^<]*)<\\/span>`);
  const m = html.match(regex);
  return m ? decodificarEntidadesHtml((m[1] ?? "").trim()) : null;
}

/**
 * Busca a página de uma obra e monta o objeto completo (com gêneros,
 * sinopse, status e autor) — a listagem do catálogo não tem esses
 * detalhes, só a página individual.
 */
export async function buscarObraPorSlugMangaLivre(slug: string): Promise<Obra | null> {
  if (!REGEX_SLUG_VALIDO.test(slug)) return null;

  const url = `${MANGALIVRE_BASE_URL}/manga/${slug}/`;

  let html: string;
  try {
    html = await fetchHtmlComTimeout(url);
  } catch (err) {
    logFalhaMangaLivre(`Falha ao buscar a obra "${slug}" no MangaLivre:`, err);
    return null;
  }

  const tituloMatch = html.match(/<h1 class="manga-title"[^>]*>([\s\S]*?)<\/h1>/);
  if (!tituloMatch) return null;

  const titulo = extrairTextoSemHtml(tituloMatch[1] ?? "");
  if (!titulo) return null;

  const capaMatch = html.match(/<img[^>]+src="([^"]+)"[^>]*class="[^"]*manga-cover-image/);

  const sinopseBlocoMatch = html.match(/<div class="synopsis-content">([\s\S]*?)<\/div>/);
  const paragrafos = sinopseBlocoMatch
    ? Array.from((sinopseBlocoMatch[1] ?? "").matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g))
        .map((m) => extrairTextoSemHtml(m[1] ?? ""))
        .filter(Boolean)
    : [];
  const sinopse = paragrafos.join("\n\n");

  // Título E sinopse — na MangaDex as duas sempre passam pela mesma
  // varredura de texto (ver `algumTextoEhAdulto`); aqui a sinopse ficava
  // de fora até esta correção, então uma obra podia ter um título limpo e
  // uma sinopse que se autodescreve como conteúdo adulto sem ser pega.
  if (REGEX_TITULO_ADULTO.test(titulo) || REGEX_TITULO_ADULTO.test(sinopse)) return null;
  if (algumTextoEhAdulto([titulo, sinopse])) return null;

  const tagsMatch = html.match(/<div class="manga-tags">([\s\S]*?)<\/div>/);
  const tagsBrutas = tagsMatch
    ? Array.from((tagsMatch[1] ?? "").matchAll(/<span class="manga-tag">([^<]+)<\/span>/g)).map((m) =>
        decodificarEntidadesHtml((m[1] ?? "").trim())
      )
    : [];

  if (tagsBrutas.some((tag) => TAGS_ADULTAS.has(tag.toLowerCase()))) return null;

  const generos = Array.from(
    new Set(tagsBrutas.map((tag) => TRADUCAO_GENEROS[tag.toLowerCase()] ?? tag))
  );

  // Segunda opinião da MangaDex sobre esta mesma obra — usada tanto
  // para confirmar o tipo editorial (ver nota abaixo) quanto como
  // camada extra do filtro de conteúdo adulto: o MangaLivre não expõe
  // `contentRating` estruturado, então uma obra "suggestive"/"erotica"
  // na MangaDex pode passar batido pelas tags do MangaLivre (achado
  // real em teste: "Regressão absoluta" tem tags só "Action"/"Fantasy"
  // no MangaLivre, mas é "suggestive" na MangaDex). Falha em consultar
  // não bloqueia a obra — é só uma camada ADICIONAL, não a única.
  const sinalMangaDex = await buscarSinalConfiavelPorTitulo(titulo).catch((err) => {
    console.warn(`Falha ao cruzar "${titulo}" com a MangaDex para segunda opinião:`, err);
    return null;
  });

  if (sinalMangaDex?.conteudoAdulto) {
    return null;
  }

  // Fail-closed: antes desta correção, quando a MangaDex não confirmava
  // NADA (busca falhou, sem correspondência exata) E o MangaLivre também
  // não tinha tag alguma na própria página, a obra ainda era ACEITA por
  // padrão — ou seja, sem nenhum sinal de nenhuma das duas fontes, o
  // comportamento era "deixar passar" em vez de "recusar por precaução".
  // Isso é o oposto do que a curadoria pediu para todo o resto do site.
  // Com pelo menos UM sinal real (tags do MangaLivre OU confirmação da
  // MangaDex) a obra segue normalmente — só o caso de zero sinal nas duas
  // fontes é que passa a ser rejeitado.
  if (tagsBrutas.length === 0 && sinalMangaDex === null) {
    console.warn(
      `Obra "${titulo}" (MangaLivre) rejeitada por precaução — sem tags no MangaLivre e sem correspondência confiável na MangaDex, impossível confirmar que não é conteúdo adulto.`
    );
    return null;
  }

  // O tema do MangaLivre raramente expõe o formato editorial como tag
  // própria ("manhwa"/"manhua") — na prática, quase toda obra só lista
  // gêneros/temas (Ação, Fantasia etc.), então essa checagem quase nunca
  // "acerta" por si só. Quando ela falha, NÃO assumimos mais "manga" por
  // padrão (isso mascarava manhwas/manhuas coreanos/chineses como mangá
  // japonês — o próprio bug que a curadoria pediu para corrigir).
  // Em vez disso, confiamos no tipo editorial vindo da segunda opinião
  // da MangaDex (país de origem via `originalLanguage`) acima.
  const tagsEmMinusculo = tagsBrutas.map((t) => t.toLowerCase());
  const tipoPelaTagExplicita: TipoObra | null = tagsEmMinusculo.includes("manhwa")
    ? "manhwa"
    : tagsEmMinusculo.includes("manhua")
      ? "manhua"
      : tagsEmMinusculo.includes("manga")
        ? "manga"
        : null;

  let tipo: TipoObra;
  if (tipoPelaTagExplicita) {
    tipo = tipoPelaTagExplicita;
  } else if (sinalMangaDex) {
    tipo = sinalMangaDex.tipo;
  } else {
    tipo = "manga";
    console.warn(
      `Não foi possível confirmar o tipo editorial de "${titulo}" (MangaLivre) — nem tag explícita, nem correspondência na MangaDex. Assumindo "manga" por padrão; revisar manualmente se estiver errado.`
    );
  }

  const status = extrairValorMeta(html, "Status") ?? "desconhecido";
  const autor = extrairValorMeta(html, "Autor");

  try {
    return ObraSchema.parse({
      id: slugParaIdMangaLivre(slug),
      titulo,
      autor,
      status,
      generos,
      sinopse,
      capa: capaMatch?.[1] ?? null,
      tipo,
      temTraducaoPtBr: true,
      capituloMaisRecentePtBr: null,
    });
  } catch (err) {
    console.warn(`Obra MangaLivre "${slug}" descartada — payload inválido:`, err);
    return null;
  }
}

/**
 * Busca a lista de capítulos direto da página da obra (o tema lista
 * todos os capítulos ali, sem paginação separada). A ordem no HTML é do
 * mais recente para o mais antigo — invertemos para bater com a ordem
 * de leitura, mesma convenção usada em lib/mangadex.ts.
 */
export async function buscarCapitulosDaObraMangaLivre(slug: string): Promise<Capitulo[]> {
  if (!REGEX_SLUG_VALIDO.test(slug)) return [];

  const url = `${MANGALIVRE_BASE_URL}/manga/${slug}/`;

  let html: string;
  try {
    html = await fetchHtmlComTimeout(url);
  } catch (err) {
    logFalhaMangaLivre(`Falha ao buscar capítulos da obra "${slug}" no MangaLivre:`, err);
    return [];
  }

  const itens = Array.from(html.matchAll(/<li class="chapter-item"[^>]*>([\s\S]*?)<\/li>/g));
  const capitulos: Capitulo[] = [];

  for (const item of itens) {
    const bloco = item[1] ?? "";
    const linkMatch = bloco.match(/<a href="([^"]+)" class="chapter-link"/);
    const numeroMatch = bloco.match(/<span class="chapter-number">\s*Cap[ií]tulo\s+([\d.]+)\s*<\/span>/i);
    const dataMatch = bloco.match(/<span class="chapter-date">([^<]+)<\/span>/);
    if (!linkMatch || !numeroMatch) continue;

    const chapterSlug = extrairSlugDaUrlDeCapitulo(linkMatch[1] ?? "");
    if (!chapterSlug) continue;

    try {
      capitulos.push(
        CapituloSchema.parse({
          id: slugParaIdMangaLivre(chapterSlug),
          numero: numeroMatch[1] ?? "?",
          titulo: null,
          idioma: "pt-br",
          publicadoEm: dataMatch ? relativoParaISO(dataMatch[1] ?? "") ?? "" : "",
        })
      );
    } catch (err) {
      console.warn(`Capítulo "${chapterSlug}" da obra "${slug}" descartado — payload inválido:`, err);
    }
  }

  return capitulos.reverse();
}

function extrairImagensDoCapitulo(html: string): string[] {
  const tags = html.match(/<img[^>]+class="[^"]*chapter-image[^"]*"[^>]*>/g) ?? [];
  const imagens: string[] = [];
  for (const tag of tags) {
    const src = tag.match(/src="([^"]+)"/)?.[1];
    if (src) imagens.push(src);
  }
  return imagens;
}

/**
 * Busca as imagens de um capítulo. O site não oferece uma versão
 * comprimida separada (como o dataSaver da MangaDex) — usamos o mesmo
 * array nos dois campos para manter o contrato de `PaginasDoCapitulo`
 * que o leitor espera.
 */
export async function buscarPaginasDoCapituloMangaLivre(chapterSlug: string): Promise<PaginasDoCapitulo> {
  if (!REGEX_SLUG_VALIDO.test(chapterSlug)) return { data: [], dataSaver: [] };

  const url = `${MANGALIVRE_BASE_URL}/capitulo/${chapterSlug}/`;
  try {
    const html = await fetchHtmlComTimeout(url, 12000);
    const paginas = extrairImagensDoCapitulo(html);
    return { data: paginas, dataSaver: paginas };
  } catch (err) {
    if (!(err instanceof MangaLivreIndisponivelError)) {
      console.error(`Falha ao buscar páginas do capítulo "${chapterSlug}" no MangaLivre:`, err);
    }
    return { data: [], dataSaver: [] };
  }
}
