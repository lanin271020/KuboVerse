import { NextRequest, NextResponse } from "next/server";
import { buscarPorTitulo } from "@/lib/catalogo";

// Busca é sempre ao vivo — não faz sentido cachear resultado de texto livre.
export const revalidate = 0;

// Nenhum título de obra chega perto disso — um "q" gigante só serviria
// para forçar processamento desnecessário (nosso ou da MangaDex).
const TAMANHO_MAXIMO_DA_BUSCA = 100;

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, TAMANHO_MAXIMO_DA_BUSCA);

  if (query.length < 2) {
    return NextResponse.json({ traduzidas: [], semTraducao: [] });
  }

  try {
    const resultado = await buscarPorTitulo(query);
    return NextResponse.json(resultado);
  } catch (err) {
    console.error(`Falha na busca por "${query}":`, err);
    return NextResponse.json(
      { error: "Não foi possível buscar agora. Tente novamente em instantes." },
      { status: 502 }
    );
  }
}
