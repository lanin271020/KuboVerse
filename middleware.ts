import { NextResponse, type NextRequest } from "next/server";
import { atualizarSessaoSupabase } from "@/lib/supabase/middleware";
import { verificarLimite } from "@/lib/rateLimit";

// Limites por grupo de rota — a busca é mais barata de abusar (texto
// livre, sem paginação) então recebe um teto mais apertado que o
// catálogo/capítulo. Ver lib/rateLimit.ts sobre as limitações desta
// implementação em memória.
const JANELA_MS = 60_000;
const LIMITES_POR_ROTA: { prefixo: string; limite: number }[] = [
  { prefixo: "/api/busca", limite: 30 },
  { prefixo: "/api/catalogo", limite: 60 },
  { prefixo: "/api/capitulo/", limite: 60 },
  { prefixo: "/api/continuar-lendo", limite: 60 },
];

function obterIpCliente(request: NextRequest): string {
  // `x-forwarded-for` pode ter vários IPs (cliente, proxies) — o primeiro
  // é o mais próximo do cliente original. Falsificável por quem não
  // passa por um proxy confiável na frente da aplicação (ver ressalva em
  // lib/rateLimit.ts) — ainda assim, bem melhor que nenhum limite.
  const encaminhado = request.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0]?.trim() ?? "desconhecido";
  return request.headers.get("x-real-ip") ?? "desconhecido";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const grupo = LIMITES_POR_ROTA.find((g) => pathname.startsWith(g.prefixo));

  if (grupo) {
    const ip = obterIpCliente(request);
    const resultado = verificarLimite(`${grupo.prefixo}:${ip}`, grupo.limite, JANELA_MS);

    if (!resultado.permitido) {
      return NextResponse.json(
        { error: "Muitas requisições. Tente novamente em instantes." },
        {
          status: 429,
          headers: { "Retry-After": Math.ceil(resultado.reiniciaEmMs / 1000).toString() },
        }
      );
    }
  }

  return atualizarSessaoSupabase(request);
}

export const config = {
  matcher: [
    /*
     * Roda em todas as rotas, exceto assets estáticos e arquivos de imagem,
     * para manter o custo de execução do middleware baixo.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
