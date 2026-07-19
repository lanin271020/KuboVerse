/**
 * Moderação de comentários — camada extra de segurança específica para
 * este site ser voltado a crianças. Antes desta checagem, qualquer
 * usuário autenticado podia publicar texto livre e público sem NENHUM
 * filtro de conteúdo (ver auditoria pré-lançamento): nem palavrão, nem
 * conteúdo sexual, nem spam/link.
 *
 * Isto não substitui a denúncia da comunidade (ver `comment_reports` na
 * migração 20260719000000) — é a primeira linha de defesa, aplicada NO
 * MOMENTO do envio, antes de o comentário existir publicamente. A
 * denúncia é a segunda linha, para o que passar batido por aqui.
 */

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Termos de conteúdo sexual/adulto — mesma régua usada para filtrar o
 * catálogo (ver REGEX_TEXTO_ADULTO em lib/mangadex.ts), mas em português
 * coloquial, já que comentários de usuários reais raramente usam os
 * termos em inglês que aparecem em título/sinopse de obras.
 */
const REGEX_CONTEUDO_SEXUAL =
  /\b(sexo|sexual|punheta|porno|pornografia|buceta|piroca|pinto|pau|xoxota|boquete|gozada|gozar|estupro|pedofil\w*|nude[sz]?|nsfw|hentai|ecchi)\b/i;

/**
 * Palavrões comuns em português — lista deliberadamente curta e focada
 * nos termos mais frequentes/graves, não uma lista exaustiva de gírias
 * regionais (o objetivo é pegar o caso óbvio, não construir um
 * dicionário completo de baixo calão).
 */
const REGEX_PALAVRAO = /\b(porra|caralho|merda|foda-?se|fdp|puta|putinha|arrombad\w*|corno|viad[oa]|retardad\w*|imbecil)\b/i;

const REGEX_URL = /https?:\/\/\S+|www\.\S+\.\w{2,}/i;

// Convite recorrente de spam ("entra no meu grupo/canal") mesmo sem uma
// URL completa (ex.: "me segue no instagram @fulano").
const REGEX_SPAM_REDE_SOCIAL =
  /\b(discord\.gg|t\.me|whatsapp|wa\.me|instagram|telegram|@\w{3,})\b.*\b(segue|entra|grupo|canal|link\s+na\s+bio)\b|\b(segue|entra|grupo|canal)\b.*\b(discord|instagram|telegram|whatsapp)\b/i;

// Texto em CAIXA ALTA repetido ou caracteres repetidos em excesso
// ("AAAAAAAA", "!!!!!!!!") — sinal comum de spam/flood, não de opinião
// legítima em maiúsculas ocasional.
const REGEX_CARACTERE_REPETIDO = /(.)\1{6,}/;

export type MotivoRejeicaoComentario =
  | "conteudo_sexual"
  | "palavrao"
  | "link"
  | "spam";

const MENSAGENS: Record<MotivoRejeicaoComentario, string> = {
  conteudo_sexual: "Esse comentário parece ter conteúdo sexual/adulto, que não é permitido aqui.",
  palavrao: "Esse comentário parece ter palavras ofensivas — tente reescrever de outro jeito.",
  link: "Não é permitido incluir links nos comentários.",
  spam: "Esse comentário foi identificado como possível spam.",
};

export interface ResultadoModeracao {
  permitido: boolean;
  motivo?: MotivoRejeicaoComentario;
  mensagem?: string;
}

/**
 * Avalia um comentário já validado pelo schema (tamanho etc.) contra as
 * regras de conteúdo do site. Fail-closed no espírito do resto do
 * catálogo: qualquer sinal de conteúdo sexual bloqueia o envio — melhor
 * um falso positivo ocasional (usuário reescreve a frase) do que deixar
 * passar conteúdo inadequado para crianças.
 */
export function avaliarComentario(textoBruto: string): ResultadoModeracao {
  const texto = normalizar(textoBruto);

  if (REGEX_CONTEUDO_SEXUAL.test(texto)) {
    return { permitido: false, motivo: "conteudo_sexual", mensagem: MENSAGENS.conteudo_sexual };
  }
  if (REGEX_URL.test(texto)) {
    return { permitido: false, motivo: "link", mensagem: MENSAGENS.link };
  }
  if (REGEX_SPAM_REDE_SOCIAL.test(texto) || REGEX_CARACTERE_REPETIDO.test(texto)) {
    return { permitido: false, motivo: "spam", mensagem: MENSAGENS.spam };
  }
  if (REGEX_PALAVRAO.test(texto)) {
    return { permitido: false, motivo: "palavrao", mensagem: MENSAGENS.palavrao };
  }

  return { permitido: true };
}
