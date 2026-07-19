import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { FormularioEntrar } from "@/components/auth/FormularioEntrar";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: true },
};

export default async function EntrarPage() {
  const usuario = await obterUsuarioAtual();
  if (usuario) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-10">
      <h1 className="mb-6 font-display text-3xl font-extrabold uppercase tracking-tight text-paper">
        Entrar
      </h1>
      {/* FormularioEntrar usa useSearchParams (para detectar ?erro=google
          vindo do redirect de falha do OAuth) — precisa de Suspense, senão
          o Next.js força a página inteira a renderização client-side. */}
      <Suspense fallback={null}>
        <FormularioEntrar />
      </Suspense>
    </main>
  );
}
