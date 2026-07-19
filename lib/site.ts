/**
 * URL pública e definitiva do site, sem "/" no final. Usada em todo lugar
 * que precisa montar uma URL ABSOLUTA sem depender do cabeçalho `Host` da
 * requisição atual (que é controlado pelo cliente) — `metadataBase`,
 * `sitemap.ts`, `robots.ts`. Ver NEXT_PUBLIC_SITE_URL em .env.example.
 *
 * `services/auth.ts` tem sua própria cópia deste fallback porque lá o
 * valor precisa ser resolvido dentro de uma Server Action (onde ler
 * `process.env` diretamente é mais simples que importar um módulo com
 * side effect de configuração) — mas a fonte da variável de ambiente é a
 * mesma.
 */
export const URL_DO_SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  ""
);
