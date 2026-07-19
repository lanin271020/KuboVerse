import type { MetadataRoute } from "next";
import { URL_DO_SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Redundante com o `robots: { index: false }` já definido nas
        // próprias páginas (entrar, cadastro, perfil, favoritos,
        // recuperar/redefinir senha, leitor de capítulo) — manter os
        // dois é intencional: a meta tag cobre robôs que IGNORAM
        // robots.txt mas respeitam a tag, e o robots.txt evita que esses
        // caminhos sejam rastreados (economizando orçamento de
        // rastreamento) mesmo antes de a página carregar.
        disallow: ["/entrar", "/cadastro", "/perfil", "/favoritos", "/recuperar-senha", "/redefinir-senha", "/api/"],
      },
    ],
    sitemap: `${URL_DO_SITE}/sitemap.xml`,
  };
}
