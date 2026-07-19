"use client";

import { useEffect } from "react";

/**
 * Só é usado se o próprio layout raiz (app/layout.tsx) falhar — nesse
 * caso o Header/providers globais não existem mais, então este arquivo
 * precisa desenhar seu próprio <html>/<body> do zero. Estilos inline de
 * propósito: o CSS do Tailwind pode não ter sido carregado se a falha
 * aconteceu antes disso.
 */
export default function ErroGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro não tratado no layout raiz:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          backgroundColor: "#0B0C10",
          color: "#EDEDEA",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Algo deu muito errado</h1>
        <p style={{ maxWidth: "24rem", color: "#8B8F98" }}>
          Não foi possível carregar o site agora. Tente novamente em instantes.
        </p>
        <button
          onClick={reset}
          style={{
            borderRadius: "0.625rem",
            backgroundColor: "#B23A2E",
            color: "#EDEDEA",
            padding: "0.625rem 1.5rem",
            border: "none",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
