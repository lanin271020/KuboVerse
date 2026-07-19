"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * Botão de submit que se desabilita automaticamente enquanto a Server
 * Action do formulário está pendente (via `useFormStatus`) — usado nos
 * formulários "sem estado" como sair/entrar com Google, que hoje não
 * tinham NENHUMA proteção contra duplo-clique/duplo-submit (dois
 * cliques rápidos disparavam duas requisições de logout/OAuth em
 * paralelo). Precisa ser um Client Component porque `useFormStatus` é um
 * hook — mas o `<form>` em volta continua podendo ser Server Component.
 */
export function BotaoEnviarFormulario({
  children,
  textoPendente,
  ...resto
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "disabled" | "aria-disabled"> & {
  children: ReactNode;
  textoPendente?: ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} aria-disabled={pending} {...resto}>
      {pending && textoPendente ? textoPendente : children}
    </button>
  );
}
