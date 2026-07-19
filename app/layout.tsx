import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { FavoritosProvider } from "@/hooks/useFavoritos";
import { URL_DO_SITE } from "@/lib/site";

const DESCRICAO_PADRAO =
  "Leitor de Manhwas, Mangás e Manhuas traduzidos em português.";

export const metadata: Metadata = {
  // Base para resolver toda URL relativa usada em metadata (Open Graph,
  // Twitter, canonical) em qualquer página que não defina a sua própria
  // — sem isso, o Next tenta inferir a partir da URL da requisição em
  // dev, mas em produção precisa ser explícito.
  metadataBase: new URL(URL_DO_SITE),
  title: {
    default: "KuboVerse",
    // Preenchido automaticamente nas páginas que só definem `title` como
    // string simples (ex.: "Entrar") — sem repetir "— KuboVerse" em cada
    // metadata espalhada pelo app.
    template: "%s — KuboVerse",
  },
  description: DESCRICAO_PADRAO,
  openGraph: {
    title: "KuboVerse",
    description: DESCRICAO_PADRAO,
    url: URL_DO_SITE,
    siteName: "KuboVerse",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "KuboVerse",
    description: DESCRICAO_PADRAO,
  },
};

// Não "async", e de propósito não busca o usuário logado aqui: este é o
// layout RAIZ, compartilhado por TODA rota do site (incluindo Home,
// /obra/[id], /sem-traducao — que quereriam ser estáticas/ISR). Chamar
// `cookies()` (o que `obterUsuarioAtual()` faz por baixo, via
// lib/supabase/server.ts) em QUALQUER ponto da árvore de renderização de
// uma página — mesmo em um componente pai como este layout, não só na
// página em si — força o Next.js a tratar a rota INTEIRA como dinâmica,
// desligando ISR por completo (mesmo bug de raiz já corrigido uma vez
// para a Home isoladamente em ContinuarLendoContainer.tsx; aqui ele
// afetava literalmente TODAS as páginas, porque vinha do layout).
// `Header` e `FavoritosProvider` resolvem a sessão no CLIENTE (ver
// useUsuarioSupabase, via onAuthStateChange) — o preço é um flash
// bem breve de "deslogado" até a hidratação confirmar a sessão, uma
// troca aceitável considerando que a alternativa é nenhuma página do
// site jamais ser cacheada.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body>
        {/* Só fica visível quando recebe foco por teclado (Tab) — permite
            pular a navegação do Header (que se repete em toda página,
            inclusive links do menu do usuário) e ir direto para o
            conteúdo principal, sem precisar tabular por tudo isso antes. */}
        <a
          href="#conteudo-principal"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-card focus:bg-jade focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink-950"
        >
          Pular para o conteúdo
        </a>
        <FavoritosProvider usuarioInicial={null}>
          <Header usuarioInicial={null} />
          <div id="conteudo-principal">{children}</div>
        </FavoritosProvider>
      </body>
    </html>
  );
}
