import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Atualiza a sessão Supabase a cada requisição, propagando os cookies de
 * autenticação renovados na resposta. Chamado pelo middleware.ts na raiz.
 *
 * Se as credenciais do Supabase ainda não estiverem configuradas, a
 * navegação continua normalmente (o site funciona sem login).
 */
export async function atualizarSessaoSupabase(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let response = NextResponse.next({ request });

  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesParaDefinir: {
          name: string;
          value: string;
          options: CookieOptions;
        }[]
      ) {
        cookiesParaDefinir.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesParaDefinir.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Necessário para revalidar o token — não remover, mesmo sem usar o valor.
  await supabase.auth.getUser();

  return response;
}
