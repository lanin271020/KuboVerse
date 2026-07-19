import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

function credenciaisSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local"
    );
  }

  return { url, anonKey };
}

/**
 * Cliente Supabase para uso em Server Components, Route Handlers e Server
 * Actions. Lê/escreve a sessão através dos cookies da requisição atual.
 *
 * Em Server Components (somente leitura de cookies) o `set` pode falhar
 * silenciosamente — é esperado, o middleware (lib/supabase/middleware.ts)
 * é responsável por manter a sessão atualizada nesses casos.
 */
export async function criarClienteSupabaseServidor() {
  const { url, anonKey } = credenciaisSupabase();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesParaDefinir: {
          name: string;
          value: string;
          options: CookieOptions;
        }[]
      ) {
        try {
          cookiesParaDefinir.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Chamado a partir de um Server Component — ignorado de propósito,
          // o middleware cuida do refresh de sessão nesse caso.
        }
      },
    },
  });
}

/**
 * Retorna o usuário autenticado da requisição atual, ou `null` se não
 * houver sessão — incluindo o caso em que o Supabase ainda não foi
 * configurado (.env vazio), para que o site continue funcionando sem login.
 */
export async function obterUsuarioAtual() {
  try {
    const supabase = await criarClienteSupabaseServidor();
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Cliente Supabase com a service role key, que ignora RLS. Use apenas em
 * código de servidor de confiança (nunca em Client Components) e apenas
 * quando for estritamente necessário. Ausente por padrão nesta etapa.
 */
export function criarClienteSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada em .env.local"
    );
  }

  return createServerClient<Database>(url, serviceRoleKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // cliente admin não usa sessão de cookies
      },
    },
  });
}
