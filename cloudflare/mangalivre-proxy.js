/**
 * Cloudflare Worker opcional para o KuboVerse raspar o MangaLivre a partir
 * da Vercel (IPs de datacenter costumam levar 403 do Cloudflare do site).
 *
 * Deploy: Cloudflare Dashboard → Workers → Create → colar este arquivo.
 * Em Variables, defina PROXY_SECRET (mesmo valor de MANGALIVRE_PROXY_SECRET
 * na Vercel). Na Vercel, aponte:
 *   MANGALIVRE_PROXY_URL=https://SEU-WORKER.workers.dev
 *   MANGALIVRE_PROXY_SECRET=...
 *
 * Contrato: GET /?url=https%3A%2F%2Fmangalivre.blog%2Fmanga%2F
 * Header obrigatório: X-Proxy-Secret: <PROXY_SECRET>
 */

const HOST_PERMITIDO = "mangalivre.blog";

export default {
  async fetch(request, env) {
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const secret = env.PROXY_SECRET;
    if (!secret || request.headers.get("X-Proxy-Secret") !== secret) {
      return new Response("Unauthorized", { status: 401 });
    }

    const destino = new URL(request.url).searchParams.get("url");
    if (!destino) {
      return new Response("Missing url", { status: 400 });
    }

    let alvo;
    try {
      alvo = new URL(destino);
    } catch {
      return new Response("Invalid url", { status: 400 });
    }

    if (alvo.protocol !== "https:" || alvo.hostname !== HOST_PERMITIDO) {
      return new Response("Host not allowed", { status: 400 });
    }

    const upstream = await fetch(alvo.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5",
        Referer: `https://${HOST_PERMITIDO}/`,
      },
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  },
};
