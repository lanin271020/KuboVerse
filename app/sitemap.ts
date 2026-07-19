import type { MetadataRoute } from "next";
import { buscarCatalogo } from "@/lib/catalogo";
import { URL_DO_SITE } from "@/lib/site";

// Mesmo teto usado em app/api/catalogo/route.ts para uma única chamada —
// o sitemap não precisa do catálogo INTEIRO, só de uma amostra ampla das
// obras mais relevantes/recentes.
const LIMITE_SITEMAP = 100;

// Acompanha o mesmo cache do catálogo (ver revalidate nas páginas que o
// consomem) — gerar este arquivo do zero em toda requisição de robô de
// busca bateria a API externa (MangaDex) sem necessidade.
export const revalidate = 600;

const PAGINAS_ESTATICAS: MetadataRoute.Sitemap = [
  { url: URL_DO_SITE, changeFrequency: "hourly", priority: 1 },
  { url: `${URL_DO_SITE}/sem-traducao`, changeFrequency: "daily", priority: 0.5 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    // Só a página de detalhe de cada obra tem valor de SEO próprio (ver
    // robots noindex no leitor e nas páginas de conta/auth).
    const catalogo = await buscarCatalogo(0, LIMITE_SITEMAP);
    const obras = [...catalogo.traduzidas, ...catalogo.semTraducao];

    const paginasDeObra: MetadataRoute.Sitemap = obras.map((obra) => ({
      url: `${URL_DO_SITE}/obra/${encodeURIComponent(obra.id)}`,
      changeFrequency: "daily",
      priority: 0.7,
    }));

    return [...PAGINAS_ESTATICAS, ...paginasDeObra];
  } catch (err) {
    console.error("Falha ao gerar sitemap dinâmico — usando só páginas estáticas:", err);
    return PAGINAS_ESTATICAS;
  }
}
