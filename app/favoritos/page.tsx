import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { acaoListarFavoritos } from "@/services/favorites";
import { GradeFavoritos } from "@/components/GradeFavoritos";

export const metadata: Metadata = {
  title: "Meus favoritos",
  robots: { index: false, follow: false },
};

export default async function FavoritosPage() {
  const usuario = await obterUsuarioAtual();

  if (!usuario) {
    redirect("/entrar");
  }

  const favoritos = await acaoListarFavoritos();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-8 font-display text-4xl font-extrabold uppercase tracking-tight text-paper md:text-5xl">
        Meus favoritos
      </h1>
      <GradeFavoritos favoritosIniciais={favoritos} />
    </main>
  );
}
