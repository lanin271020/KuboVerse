/** @type {import('next').NextConfig} */

// Content-Security-Policy fica aqui (estática, sem nonce) de propósito.
// Um CSP com nonce por requisição (script-src 'nonce-...' 'strict-dynamic')
// só funciona em rotas dinamicamente renderizadas — em páginas estáticas
// (ISR/prerendered, que este catálogo usa de propósito para não bater no
// rate limit da MangaDex a cada visita) o Next.js não tem como injetar o
// nonce nos <script> que ele mesmo gera, e o navegador bloquearia até a
// hidratação da própria página. `'unsafe-inline'` aqui é um trade-off
// aceito: a proteção real contra XSS neste projeto vem do React escapar
// automaticamente todo conteúdo dinâmico (não há `dangerouslySetInnerHTML`
// em lugar nenhum do código), não do CSP — o CSP é uma camada extra.
const scriptSrc =
  process.env.NODE_ENV === "development"
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";

// img-src precisa ficar aberto (`https:`) porque o leitor carrega páginas
// de nós variáveis da rede MangaDex@Home (sem lista fixa de hosts — é
// assim que o serviço funciona) e avatares vêm do provedor OAuth de cada
// usuário. connect-src libera o domínio do Supabase (URL varia por
// projeto/ambiente, daí o wildcard) para as chamadas de autenticação
// feitas direto do navegador.
const CSP = [
  `default-src 'self'`,
  `script-src ${scriptSrc}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' https: data: blob:`,
  `font-src 'self' data:`,
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `upgrade-insecure-requests`,
].join("; ");

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "uploads.mangadex.org",
      },
      {
        protocol: "https",
        hostname: "mangalivre.blog",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          // Reforça o `frame-ancestors 'none'` do CSP acima para
          // navegadores antigos que não entendem essa diretiva.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
