import type { Config } from "tailwindcss";

// Token system — ver DESIGN.md para o racional de cada escolha.
// Paleta "tinta e selo": preto levemente azulado (não preto puro) + um
// vermelho de selo/hanko como assinatura, e um verde-jade como acento
// secundário para estados "novo".
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0B0C10", // fundo principal
          900: "#15171C", // painéis, cards
          800: "#1C1F26",
          700: "#272B33", // bordas, divisores
        },
        paper: {
          DEFAULT: "#EDEDEA", // texto primário
          muted: "#8B8F98", // texto secundário
        },
        hanko: {
          DEFAULT: "#B23A2E", // acento primário (CTAs, "iniciar leitura")
          hover: "#C9483B",
        },
        jade: {
          DEFAULT: "#3FA796", // acento secundário (capítulo novo, links ativos)
          hover: "#4DBCA9",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        card: "0.625rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
