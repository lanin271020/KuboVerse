import Link from "next/link";
import { BarraDeBusca } from "@/components/BarraDeBusca";
import { GradeCatalogo } from "@/components/GradeCatalogo";
import { ContinuarLendoContainer } from "@/components/ContinuarLendoContainer";
import { buscarCatalogo, LIMITE_PADRAO_CATALOGO } from "@/lib/catalogo";
import type { Obra } from "@/lib/types";

// Server Component: chama o repository diretamente, sem passar pela
// própria Route Handler (/api/catalogo). Isso evita depender de uma URL
// base configurada e economiza um hop de rede desnecessário — a Route
// Handler segue existindo para o "carregar mais" do lado do client.
//
// CRÍTICO para o `revalidate` abaixo funcionar de verdade: esta página
// NÃO pode chamar (direta ou indiretamente) nenhuma função dinâmica do
// Next (cookies()/headers()) — isso incluía `acaoListarContinuarLendo()`
// até esta correção, que forçava a rota INTEIRA a renderizar sob
// demanda a cada visita, ignorando por completo este `revalidate` e o
// cache do catálogo (MangaDex era buscada de novo sempre).
// "Continuar lendo" (que de fato depende da sessão do usuário) agora
// vive num componente client separado que busca seus próprios dados via
// /api/continuar-lendo — ver ContinuarLendoContainer.tsx.
export const revalidate = 600;

export default async function Home() {
  const catalogo = await buscarCatalogo().catch((err) => {
    console.error("Falha ao carregar o catálogo na Home:", err);
    return null as { traduzidas: Obra[]; semTraducao: Obra[]; temMais: boolean } | null;
  });

  if (!catalogo) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-display text-xl text-paper">
          Não conseguimos carregar as obras agora.
        </p>
        <p className="text-paper-muted">
          A fonte de dados pode estar indisponível. Tente recarregar em instantes.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="sr-only">KuboVerse</h1>

      <div className="mb-8 max-w-xl">
        <BarraDeBusca />
      </div>

      <ContinuarLendoContainer />

      <section aria-label="Obras traduzidas em português">
        <GradeCatalogo
          obrasIniciais={catalogo.traduzidas}
          temMaisInicial={catalogo.temMais}
          offsetInicial={LIMITE_PADRAO_CATALOGO}
          campo="traduzidas"
          comFiltros
        />
      </section>

      {catalogo.semTraducao.length > 0 && (
        <div className="mt-10 text-center">
          <Link
            href="/sem-traducao"
            className="text-sm text-jade hover:text-jade-hover"
          >
            Ver obras ainda sem tradução em português →
          </Link>
        </div>
      )}
    </main>
  );
}
