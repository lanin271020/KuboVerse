import { NextResponse } from "next/server";
import { criarClienteSupabaseServidor } from "@/lib/supabase/server";

/**
 * Valida que `next` é um caminho INTERNO relativo, nunca uma URL
 * completa para outro domínio — sem isso, um link como
 * `/auth/callback?next=https://site-falso.com` (ou `//site-falso.com`,
 * que navegadores tratam como protocol-relative) faria
 * `new URL(proximo, url.origin)` abaixo resolver para o domínio
 * ATACANTE em vez do nosso, porque uma URL absoluta como segundo
 * argumento de `new URL()` IGNORA a base. Isso é um open redirect
 * clássico — sério aqui porque o link vem de e-mails de confirmação/
 * recuperação de senha, que parecem legítimos por virem do próprio
 * remetente do Supabase.
 */
function caminhoRedirectSeguro(valor: string | null): string {
  if (!valor) return "/";
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.startsWith("/\\")) {
    return "/";
  }
  if (valor.includes("://")) return "/";
  return valor;
}

/**
 * Ponto de retorno dos e-mails de confirmação de cadastro e de recuperação
 * de senha do Supabase (fluxo PKCE): troca o `code` da URL por uma sessão
 * válida (via cookies) e então redireciona para o destino final.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const proximo = caminhoRedirectSeguro(url.searchParams.get("next"));

  if (code) {
    try {
      const supabase = await criarClienteSupabaseServidor();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("Falha ao trocar código por sessão:", error);
        return NextResponse.redirect(new URL("/entrar", url.origin));
      }
    } catch (err) {
      console.error("Falha ao processar callback de autenticação:", err);
      return NextResponse.redirect(new URL("/entrar", url.origin));
    }
  }

  return NextResponse.redirect(new URL(proximo, url.origin));
}
