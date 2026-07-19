"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ObraCard } from "./ObraCard";
import type { Obra, TipoObra } from "@/lib/types";

const LIMITE_POR_PAGINA = 20;

type FiltroFormato = "todos" | TipoObra;

const ABAS_FORMATO: { valor: FiltroFormato; rotulo: string }[] = [
  { valor: "todos", rotulo: "Tudo" },
  { valor: "manhwa", rotulo: "Manhwas" },
  { valor: "manga", rotulo: "Mangás" },
  { valor: "manhua", rotulo: "Manhuas" },
];

function normalizarGenero(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Recorte de categorias populares para filtro rápido — não é a lista
 * completa de gêneros/temas das fontes, só os mais buscados.
 *
 * Cada categoria lista variações do mesmo gênero (MangaDex costuma
 * devolver o nome já em pt-br, mas cai para inglês quando a tag não tem
 * tradução) — sem isso, o botão em português só batia com obras que por
 * acaso devolveram o gênero já traduzido, fazendo o filtro mostrar
 * "nenhuma obra" mesmo quando a categoria tinha itens no catálogo.
 */
const CATEGORIAS_EM_DESTAQUE: { rotulo: string; chaves: string[] }[] = [
  { rotulo: "Ação", chaves: ["ação", "acao", "action"] },
  { rotulo: "Romance", chaves: ["romance"] },
  { rotulo: "Fantasia", chaves: ["fantasia", "fantasy"] },
  { rotulo: "Isekai", chaves: ["isekai"] },
  { rotulo: "Drama", chaves: ["drama"] },
  { rotulo: "Comédia", chaves: ["comédia", "comedia", "comedy"] },
].map((c) => ({ ...c, chaves: c.chaves.map(normalizarGenero) }));

// Limite de vezes que "carregar mais" dispara AUTOMATICAMENTE quando um
// filtro ativo zera os resultados já carregados — evita um loop de
// requisições sem fim caso a categoria/formato escolhido seja raro (ou
// inexistente) no restante do catálogo; passado esse limite, o usuário
// ainda pode clicar manualmente no botão "Carregar mais".
const LIMITE_AUTO_CARREGAMENTOS = 3;

interface GradeCatalogoProps {
  obrasIniciais: Obra[];
  temMaisInicial: boolean;
  // Quantos itens BRUTOS (antes do filtro de sequência de capítulos) a
  // página já consumiu da fonte para montar `obrasIniciais` — normalmente
  // igual ao `limit` passado para `buscarCatalogo()` no servidor. NÃO é o
  // mesmo que `obrasIniciais.length`: a curadoria de sequência pode remover
  // itens, então o número de obras exibidas é sempre <= ao número de itens
  // brutos já consumidos. Usar `obrasIniciais.length` aqui faria "carregar
  // mais" reconsultar itens brutos já vistos (e potencialmente já exibidos)
  // sempre que a curadoria removesse algo da primeira leva, duplicando
  // obras na grade.
  offsetInicial: number;
  // Qual categoria da resposta de /api/catalogo esta grade deve consumir
  // ao carregar mais — permite reusar o mesmo componente na Home
  // (traduzidas) e em /sem-traducao (semTraducao).
  campo: "traduzidas" | "semTraducao";
  // Mostra as abas de formato e os botões de categoria. Desligado em
  // /sem-traducao, onde a lista já é curta e um filtro extra só
  // adicionaria ruído sem ajudar.
  comFiltros?: boolean;
}

export function GradeCatalogo({
  obrasIniciais,
  temMaisInicial,
  offsetInicial,
  campo,
  comFiltros = false,
}: GradeCatalogoProps) {
  const [obras, setObras] = useState(obrasIniciais);
  const [offset, setOffset] = useState(offsetInicial);
  const [temMais, setTemMais] = useState(temMaisInicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const [formato, setFormato] = useState<FiltroFormato>("todos");
  const [categoria, setCategoria] = useState<string | null>(null);
  const autoCarregamentosRef = useRef(0);

  async function carregarMais() {
    setCarregando(true);
    setErro(false);
    try {
      const res = await fetch(`/api/catalogo?offset=${offset}&limit=${LIMITE_POR_PAGINA}`);
      if (!res.ok) throw new Error(`resposta ${res.status}`);
      const json: { traduzidas: Obra[]; semTraducao: Obra[]; temMais: boolean } = await res.json();

      const novasObras = json[campo];
      // Defesa extra além da correção do offset acima: se a fonte externa
      // ainda assim devolver algum id repetido (dado upstream mudou de
      // ordem entre as duas chamadas, por exemplo), não deixamos duplicar
      // a key do React nem a obra na grade.
      setObras((atual) => {
        const idsExistentes = new Set(atual.map((obra) => obra.id));
        const semRepetidas = novasObras.filter((obra) => !idsExistentes.has(obra.id));
        return [...atual, ...semRepetidas];
      });
      setOffset((atual) => atual + LIMITE_POR_PAGINA);
      setTemMais(json.temMais);
    } catch (err) {
      console.error("Falha ao carregar mais obras:", err);
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }

  // Filtro é só client-side, sobre o que já foi carregado — "instantâneo"
  // como pedido, sem round-trip à API a cada clique. Se o filtro não
  // achar nada nas obras já carregadas, "carregar mais" ainda funciona
  // normalmente e traz mais candidatas para o filtro atual.
  const obrasFiltradas = useMemo(() => {
    if (!comFiltros) return obras;
    const chavesCategoria = categoria
      ? CATEGORIAS_EM_DESTAQUE.find((c) => c.rotulo === categoria)?.chaves ?? [categoria]
      : null;
    return obras.filter((obra) => {
      const bateFormato = formato === "todos" || obra.tipo === formato;
      const bateCategoria =
        !chavesCategoria ||
        obra.generos.some((genero) => chavesCategoria.includes(normalizarGenero(genero)));
      return bateFormato && bateCategoria;
    });
  }, [obras, formato, categoria, comFiltros]);

  // Se um filtro ativo zerou os resultados já carregados, tenta buscar
  // mais páginas automaticamente (com um limite) em vez de deixar o
  // usuário achar que "não há obras" e precisar clicar em "Carregar mais"
  // repetidas vezes só para descobrir que existem, só numa página adiante.
  useEffect(() => {
    if (!comFiltros || obrasFiltradas.length > 0) {
      autoCarregamentosRef.current = 0;
      return;
    }
    if (!temMais || carregando) return;
    if (autoCarregamentosRef.current >= LIMITE_AUTO_CARREGAMENTOS) return;

    autoCarregamentosRef.current += 1;
    void carregarMais();
    // carregarMais não entra nas deps de propósito: é recriada a cada
    // render, mas sempre lê os valores mais recentes de offset/campo via
    // closure — incluí-la reexecutaria este efeito a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comFiltros, obrasFiltradas.length, temMais, carregando]);

  return (
    <div>
      {comFiltros && (
        <div className="mb-6 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2 border-b border-ink-700 pb-3">
            {ABAS_FORMATO.map((aba) => (
              <button
                key={aba.valor}
                onClick={() => setFormato(aba.valor)}
                aria-pressed={formato === aba.valor}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  formato === aba.valor
                    ? "bg-hanko text-paper"
                    : "text-paper-muted hover:text-paper"
                }`}
              >
                {aba.rotulo}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoria(null)}
              aria-pressed={categoria === null}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                categoria === null
                  ? "border-jade text-jade"
                  : "border-ink-700 text-paper-muted hover:text-paper"
              }`}
            >
              Todas categorias
            </button>
            {CATEGORIAS_EM_DESTAQUE.map(({ rotulo }) => (
              <button
                key={rotulo}
                onClick={() => setCategoria((atual) => (atual === rotulo ? null : rotulo))}
                aria-pressed={categoria === rotulo}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  categoria === rotulo
                    ? "border-jade text-jade"
                    : "border-ink-700 text-paper-muted hover:text-paper"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {obrasFiltradas.map((obra) => (
          <ObraCard key={obra.id} obra={obra} />
        ))}
      </div>

      {comFiltros && obrasFiltradas.length === 0 && (
        <p className="mt-6 text-center text-sm text-paper-muted">
          {temMais
            ? "Nenhuma obra com esse filtro entre as já carregadas — tente \"Carregar mais\"."
            : "Nenhuma obra encontrada com esse filtro."}
        </p>
      )}

      {erro && (
        <p className="mt-4 text-center text-sm text-hanko">
          Não foi possível carregar mais obras. Tente novamente.
        </p>
      )}

      {temMais && (
        <div className="mt-8 text-center">
          <button
            onClick={carregarMais}
            disabled={carregando}
            className="rounded-card border border-ink-700 px-6 py-2.5 text-sm text-paper transition-colors hover:bg-ink-900 disabled:opacity-50"
          >
            {carregando ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      )}
    </div>
  );
}
