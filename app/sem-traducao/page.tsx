import type { Metadata } from "next";
import Link from "next/link";
import { GradeCatalogo } from "@/components/GradeCatalogo";
import { buscarCatalogo, LIMITE_PADRAO_CATALOGO } from "@/lib/catalogo";
import type { Obra } from "@/lib/types";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Obras sem tradução em português",
  description:
    "Manhwas, mangás e manhuas do catálogo que ainda não têm capítulos traduzidos para português.",
};

export default async function SemTraducaoPage() {
  let semTraducao: Obra[] = [];
  let temMais = false;
  let falhaAoCarregar = false;

  try {
    const catalogo = await buscarCatalogo();
    semTraducao = catalogo.semTraducao;
    temMais = catalogo.temMais;
  } catch (err) {
    console.error("Falha ao carregar obras sem tradução:", err);
    falhaAoCarregar = true;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/" className="text-sm text-paper-muted hover:text-paper">
        ← Voltar ao catálogo
      </Link>

      <h1 className="mb-2 mt-4 font-display text-2xl font-semibold text-paper">
        Obras sem tradução em português
      </h1>
      <p className="mb-8 text-sm text-paper-muted">
        Estas obras ainda não têm capítulos traduzidos para pt-BR na MangaDex.
      </p>

      {falhaAoCarregar && (
        <p className="text-hanko">
          Não conseguimos carregar esta lista agora. Tente novamente em instantes.
        </p>
      )}

      {!falhaAoCarregar && semTraducao.length === 0 && (
        <p className="text-paper-muted">
          Nenhuma obra nesta categoria no momento — todo o catálogo atual já
          tem tradução em português.
        </p>
      )}

      {!falhaAoCarregar && semTraducao.length > 0 && (
        <GradeCatalogo
          obrasIniciais={semTraducao}
          temMaisInicial={temMais}
          offsetInicial={LIMITE_PADRAO_CATALOGO}
          campo="semTraducao"
        />
      )}
    </main>
  );
}
