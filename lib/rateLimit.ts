/**
 * Rate limiting básico para as rotas públicas de API (ver middleware.ts).
 *
 * Implementação em memória (janela fixa por IP) — funciona bem numa
 * única instância/processo, mas tem duas limitações honestas que vale
 * deixar explícitas em vez de fingir que isto é uma solução completa:
 *
 * 1. Não é compartilhada entre múltiplas instâncias/regiões (cada
 *    processo tem seu próprio contador) — num deploy com vários
 *    servidores, o limite real efetivo é "N × número de instâncias".
 * 2. É perdida a cada reinício/cold start do processo.
 *
 * Para um site com tráfego relevante, o passo natural depois disto é
 * trocar por um limitador com estado compartilhado (ex.: Upstash Redis +
 * `@upstash/ratelimit`) — mas mesmo esta versão em memória já fecha a
 * lacuna crítica apontada na auditoria: hoje não existe limite NENHUM,
 * então qualquer script pode martelar `/api/busca`/`/api/catalogo` sem
 * fricção alguma (o que também é o principal jeito de estourar o rate
 * limit da própria MangaDex/MangaLivre e arriscar um bloqueio de IP).
 */

interface Contador {
  quantidade: number;
  reiniciaEm: number;
}

const contadores = new Map<string, Contador>();

// Poda periódica para o Map não crescer sem limite com IPs que já
// expiraram — roda no máximo 1x por minuto, de forma lazy (dentro da
// própria chamada de limite, sem timer/setInterval separado — não
// disponível de forma confiável no runtime de Edge do middleware).
let ultimaPodaEm = 0;
const INTERVALO_PODA_MS = 60_000;

function podarExpirados(agora: number) {
  if (agora - ultimaPodaEm < INTERVALO_PODA_MS) return;
  ultimaPodaEm = agora;
  for (const [chave, contador] of contadores) {
    if (contador.reiniciaEm <= agora) {
      contadores.delete(chave);
    }
  }
}

export interface ResultadoRateLimit {
  permitido: boolean;
  restante: number;
  reiniciaEmMs: number;
}

/**
 * Janela fixa simples: `limite` requisições por `janelaMs`, por `chave`
 * (normalmente IP + grupo de rota). Menos preciso que uma janela
 * deslizante/token bucket, mas muito mais simples — suficiente para o
 * objetivo aqui, que é impedir abuso grosseiro, não modelar tráfego com
 * precisão.
 */
export function verificarLimite(chave: string, limite: number, janelaMs: number): ResultadoRateLimit {
  const agora = Date.now();
  podarExpirados(agora);

  const existente = contadores.get(chave);

  if (!existente || existente.reiniciaEm <= agora) {
    contadores.set(chave, { quantidade: 1, reiniciaEm: agora + janelaMs });
    return { permitido: true, restante: limite - 1, reiniciaEmMs: janelaMs };
  }

  if (existente.quantidade >= limite) {
    return { permitido: false, restante: 0, reiniciaEmMs: existente.reiniciaEm - agora };
  }

  existente.quantidade += 1;
  return {
    permitido: true,
    restante: limite - existente.quantidade,
    reiniciaEmMs: existente.reiniciaEm - agora,
  };
}
