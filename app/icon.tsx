import { ImageResponse } from "next/og";

// Convenção de arquivo de metadata do Next.js: sem isto (nem um
// favicon.ico estático em /public), o navegador pedia /favicon.ico e
// recebia 404 — pequeno, mas visível em toda aba do site. Gerado em vez
// de um arquivo estático para não depender de nenhum asset binário
// versionado, e para acompanhar a paleta "tinta e selo" do site (ver
// tailwind.config.ts) direto no código.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0C10",
          borderRadius: "6px",
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#A855F7",
            fontFamily: "sans-serif",
          }}
        >
          K
        </span>
      </div>
    ),
    { ...size }
  );
}
