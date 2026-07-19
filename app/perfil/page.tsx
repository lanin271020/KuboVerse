import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { buscarPerfil } from "@/services/profiles";
import { FormularioPerfil } from "@/components/auth/FormularioPerfil";
import { BotaoSair } from "@/components/auth/BotaoSair";

export const metadata: Metadata = {
  title: "Meu perfil",
  robots: { index: false, follow: false },
};

export default async function PerfilPage() {
  const usuario = await obterUsuarioAtual();

  if (!usuario) {
    redirect("/entrar");
  }

  const perfil = await buscarPerfil(usuario.id);
  const nomeAtual = perfil?.nome ?? "";

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-1 font-display text-3xl font-extrabold uppercase tracking-tight text-paper">
        Meu perfil
      </h1>
      <p className="mb-6 text-sm text-paper-muted">{usuario.email}</p>

      <FormularioPerfil nomeAtual={nomeAtual} />

      <div className="mt-10 border-t border-ink-700 pt-6">
        <BotaoSair />
      </div>
    </main>
  );
}
