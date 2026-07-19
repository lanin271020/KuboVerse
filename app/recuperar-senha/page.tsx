import type { Metadata } from "next";
import { FormularioRecuperarSenha } from "@/components/auth/FormularioRecuperarSenha";

export const metadata: Metadata = {
  title: "Recuperar senha",
  robots: { index: false, follow: true },
};

export default function RecuperarSenhaPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-10">
      <h1 className="mb-6 font-display text-3xl font-extrabold uppercase tracking-tight text-paper">
        Recuperar senha
      </h1>
      <FormularioRecuperarSenha />
    </main>
  );
}
