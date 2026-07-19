import { NextResponse } from "next/server";
import { acaoListarContinuarLendo } from "@/services/history";

/**
 * Isola a busca de "Continuar lendo" (depende de cookies() → sessão do
 * usuário) numa Route Handler própria, chamada pelo client depois da
 * montagem (ver components/ContinuarLendoContainer.tsx).
 *
 * Isso é o que permite a Home (app/page.tsx) voltar a ser ISR de verdade:
 * antes desta rota existir, `acaoListarContinuarLendo()` era chamada
 * DIRETO na árvore de render da Home, e o uso de `cookies()` em qualquer
 * ponto dessa árvore força o Next a renderizar a rota inteira sob
 * demanda (dynamic rendering) — ignorando por completo o
 * `export const revalidate = 600` da página, e com isso também o cache
 * do catálogo (MangaDex), que passava a ser buscado de novo a
 * cada visita. Uma Route Handler separada é dinâmica só nela mesma, sem
 * "contaminar" a página que a chama de fora via fetch do client.
 */
export const revalidate = 0;

export async function GET() {
  const itens = await acaoListarContinuarLendo();
  return NextResponse.json({ itens });
}
