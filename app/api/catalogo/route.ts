import { NextRequest, NextResponse } from "next/server";
import { buscarCatalogo } from "@/lib/catalogo";

// Cache de 10 minutos — evita bater no rate limit da MangaDex a cada
// visita e mantém o catálogo "vivo" o suficiente. Como offset/limit
// variam a cada chamada de "carregar mais", cada combinação diferente
// de parâmetros tem seu próprio cache.
export const revalidate = 600;

// Tetos além dos quais não faz sentido paginar de uma vez — sem eles, um
// `limit` gigante forçaria buscas pesadas na MangaDex a cada chamada
// (um vetor fácil de abuso, mesmo sem intenção maliciosa).
const LIMITE_MAXIMO = 100;
const OFFSET_MAXIMO = 100_000;

// `Number(null) === 0` em JS — sem o `valor === null` explícito aqui, um
// parâmetro AUSENTE (não só invalido) seria tratado como "0" em vez do
// padrão, quebrando silenciosamente offset/limit em qualquer chamada que
// omita a querystring (ex.: acessar /api/catalogo direto, sem parâmetros).
//
// `minimo` existe separadamente do "0 vira padrão" acima porque offset=0
// é um valor legítimo (primeira página), mas limit=0 não é.
function parseInteiro(valor: string | null, padrao: number, minimo: number, maximo: number): number {
  if (valor === null) return padrao;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < minimo) return padrao;
  return Math.min(numero, maximo);
}

export async function GET(request: NextRequest) {
  const offset = parseInteiro(request.nextUrl.searchParams.get("offset"), 0, 0, OFFSET_MAXIMO);
  const limit = parseInteiro(request.nextUrl.searchParams.get("limit"), 20, 1, LIMITE_MAXIMO);

  try {
    const catalogo = await buscarCatalogo(offset, limit);
    return NextResponse.json(catalogo);
  } catch (err) {
    console.error("Falha ao buscar catálogo da MangaDex:", err);
    return NextResponse.json(
      { error: "Não foi possível carregar o catálogo agora. Tente novamente em instantes." },
      { status: 502 }
    );
  }
}
