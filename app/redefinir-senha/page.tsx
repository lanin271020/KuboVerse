import type { Metadata } from "next";
import Link from "next/link";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { FormularioRedefinirSenha } from "@/components/auth/FormularioRedefinirSenha";

export const metadata: Metadata = {
  title: "Redefinir senha",
  robots: { index: false, follow: false },
};

export default async function RedefinirSenhaPage() {
  const usuario = await obterUsuarioAtual();

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-10">
      <h1 className="mb-6 font-display text-3xl font-extrabold uppercase tracking-tight text-paper">
        Redefinir senha
      </h1>

      {usuario ? (
        <FormularioRedefinirSenha />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-hanko">
            Este link de redefinição é inválido ou já expirou.
          </p>
          <Link href="/recuperar-senha" className="text-sm text-jade hover:text-jade-hover">
            Solicitar um novo link
          </Link>
        </div>
      )}
    </main>
  );
}
