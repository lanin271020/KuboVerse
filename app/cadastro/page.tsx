import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { FormularioCadastro } from "@/components/auth/FormularioCadastro";

export const metadata: Metadata = {
  title: "Criar conta",
  robots: { index: false, follow: true },
};

export default async function CadastroPage() {
  const usuario = await obterUsuarioAtual();
  if (usuario) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-10">
      <h1 className="mb-6 font-display text-3xl font-extrabold uppercase tracking-tight text-paper">
        Criar conta
      </h1>
      <FormularioCadastro />
    </main>
  );
}
