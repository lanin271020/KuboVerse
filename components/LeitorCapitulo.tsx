"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TipoObra } from "@/lib/types";
import { acaoSalvarProgresso } from "@/services/history";

// Tempo sem mudança de página/rolagem antes de persistir o progresso —
// evita gravar no banco a cada pixel rolado ou a cada clique de "próxima
// página". Uma falha ao salvar é silenciosa (não é um erro do usuário,
// e ele pode nem estar logado — o backend já trata isso de propósito).
const ATRASO_SALVAR_PROGRESSO_MS = 2500;

type ModoLeitura = "vertical" | "paginado";

// Padrão por tipo de obra, conforme decidido: manhwa usa scroll vertical
// contínuo; mangá/manhua usam paginado. O usuário pode trocar manualmente
// — a escolha vale só para a sessão de leitura atual (sem persistência,
// já que ainda não há backend/usuário nesta fase do projeto).
const MODO_PADRAO_POR_TIPO: Record<TipoObra, ModoLeitura> = {
  manhwa: "vertical",
  manga: "paginado",
  manhua: "paginado",
};

// Preferência de economia de dados, ao contrário do modo de leitura,
// persiste entre capítulos e sessões — é uma escolha sobre a conexão do
// usuário, não sobre esta leitura específica.
const CHAVE_ECONOMIA_DE_DADOS = "leitor:economia-de-dados";

// Proporção retrato típica de uma página de manhwa/mangá, usada como
// espaço reservado (skeleton) enquanto a imagem real ainda não carregou.
// Isso evita o "layout shift": sem uma altura reservada, cada página que
// termina de carregar empurra todo o conteúdo abaixo dela.
const PROPORCAO_PADRAO_DA_PAGINA = "2 / 3";

// Rolagem automática (hands-free): velocidade em pixels por frame
// (~60fps), então 1.5 ≈ 90px/s — um ritmo de leitura confortável como
// padrão. Ajustável pelo usuário entre esses limites.
const VELOCIDADE_ROLAGEM_MINIMA = 0.5;
const VELOCIDADE_ROLAGEM_MAXIMA = 6;
const VELOCIDADE_ROLAGEM_PADRAO = 1.5;
const PASSO_VELOCIDADE_ROLAGEM = 0.5;

type StatusDaPagina = "carregando" | "ok" | "erro" | "recarregando";

interface EstadoDaPagina {
  src: string;
  status: StatusDaPagina;
  // Atualizada com a dimensão real da imagem quando ela termina de
  // carregar, para que o container pare de usar a proporção padrão (que
  // é só uma estimativa) e passe a refletir o tamanho real da página.
  proporcao: string;
}

interface RespostaPaginas {
  data: string[];
  dataSaver: string[];
}

function estadoInicial(fonte: string[]): EstadoDaPagina[] {
  return fonte.map((src) => ({
    src,
    status: "carregando",
    proporcao: PROPORCAO_PADRAO_DA_PAGINA,
  }));
}

/**
 * Atualiza a página em `indice` com `mudancas`, sem mutar a lista
 * original. Se o índice estiver fora dos limites (não deveria acontecer,
 * mas `noUncheckedIndexedAccess` nos obriga a lidar com isso), devolve a
 * lista inalterada em vez de quebrar.
 */
function atualizarPagina(
  lista: EstadoDaPagina[],
  indice: number,
  mudancas: Partial<EstadoDaPagina>
): EstadoDaPagina[] {
  const atual = lista[indice];
  if (!atual) return lista;
  const copia = [...lista];
  copia[indice] = { ...atual, ...mudancas };
  return copia;
}

interface LeitorCapituloProps {
  obraId: string;
  obraTitulo: string;
  tipoObra: TipoObra;
  capituloId: string;
  numeroCapitulo: string;
  paginasAltaQualidade: string[];
  paginasEconomiaDados: string[];
  // Página (0-indexada) de onde retomar a leitura, vinda do progresso
  // salvo em "Continuar lendo" — ver app/obra/[id]/ler/[capituloId]/page.tsx.
  // 0 quando não há progresso salvo para ESTE capítulo específico.
  paginaInicial?: number;
  capituloAnteriorId: string | null;
  proximoCapituloId: string | null;
}

export function LeitorCapitulo({
  obraId,
  obraTitulo,
  tipoObra,
  capituloId,
  numeroCapitulo,
  paginasAltaQualidade,
  paginasEconomiaDados,
  paginaInicial = 0,
  capituloAnteriorId,
  proximoCapituloId,
}: LeitorCapituloProps) {
  const router = useRouter();
  const [modo, setModo] = useState<ModoLeitura>(MODO_PADRAO_POR_TIPO[tipoObra]);
  const [paginaAtual, setPaginaAtual] = useState(paginaInicial);
  const [economiaDeDados, setEconomiaDeDados] = useState(false);
  const [rolagemAutomatica, setRolagemAutomatica] = useState(false);
  const [velocidadeRolagem, setVelocidadeRolagem] = useState(VELOCIDADE_ROLAGEM_PADRAO);
  const [zoomAtivo, setZoomAtivo] = useState(false);
  const [reduzirMovimento, setReduzirMovimento] = useState(false);

  // Nem toda resposta da MangaDex traz a versão dataSaver preenchida (é
  // raro, mas acontece); nesse caso caímos de volta para alta qualidade
  // em vez de mostrar um leitor com páginas faltando.
  const dataSaverDisponivel = paginasEconomiaDados.length === paginasAltaQualidade.length;
  const fonteAtual =
    economiaDeDados && dataSaverDisponivel ? paginasEconomiaDados : paginasAltaQualidade;

  const [paginas, setPaginas] = useState<EstadoDaPagina[]>(() => estadoInicial(fonteAtual));

  // Lê a preferência salva só depois da montagem: localStorage não existe
  // durante a renderização no servidor, então ler antes causaria um erro
  // de hidratação.
  useEffect(() => {
    const salvo = window.localStorage.getItem(CHAVE_ECONOMIA_DE_DADOS);
    if (salvo === "1") {
      setEconomiaDeDados(true);
    }
  }, []);

  // Troca todo o conjunto de URLs quando o modo de qualidade muda,
  // reiniciando o status de carregamento de cada página.
  useEffect(() => {
    setPaginas(estadoInicial(fonteAtual));
    // fonteAtual é derivada de economiaDeDados + props (que não mudam
    // depois da montagem) — refazer o efeito só quando o modo muda evita
    // recriar a lista de páginas em todo re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [economiaDeDados]);

  function alternarModo() {
    setModo((atual) => (atual === "vertical" ? "paginado" : "vertical"));
    setPaginaAtual(0);
  }

  // No modo scroll contínuo não há um "índice de página atual" explícito
  // (todas vão carregando conforme o usuário rola). Estimamos qual página
  // está em vista pela fração já rolada da altura total do documento —
  // impreciso página a página, mas suficiente para retomar a leitura
  // depois em "Continuar lendo".
  const [paginaEmVistaNoScroll, setPaginaEmVistaNoScroll] = useState(0);

  useEffect(() => {
    if (modo !== "vertical" || paginas.length === 0) return;

    let quadroPendente = false;

    function calcularPaginaEmVista() {
      quadroPendente = false;
      const alturaRolavel = document.documentElement.scrollHeight - window.innerHeight;
      const fracaoRolada = alturaRolavel > 0 ? window.scrollY / alturaRolavel : 0;
      const indice = Math.min(
        paginas.length - 1,
        Math.max(0, Math.round(fracaoRolada * (paginas.length - 1)))
      );
      setPaginaEmVistaNoScroll(indice);
    }

    function aoRolar() {
      if (quadroPendente) return;
      quadroPendente = true;
      window.requestAnimationFrame(calcularPaginaEmVista);
    }

    calcularPaginaEmVista();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, [modo, paginas.length]);

  // Restaura a posição de leitura no modo scroll contínuo (o modo paginado
  // já nasce na página certa via `useState(paginaInicial)` acima). Cada
  // página reserva sua altura real via `aspect-ratio` mesmo antes da
  // imagem carregar (ver PaginaDoLeitor), então a altura total do
  // documento já é uma estimativa razoável logo no primeiro layout —
  // suficiente para pular para a fração correspondente à página salva.
  // Roda só uma vez por montagem (`restauradoRef`), nunca de novo depois
  // que o usuário começa a rolar por conta própria.
  const restauradoRef = useRef(false);
  useEffect(() => {
    if (modo !== "vertical" || restauradoRef.current) return;
    if (paginaInicial <= 0 || paginas.length === 0) return;

    restauradoRef.current = true;
    const idQuadro = window.requestAnimationFrame(() => {
      const alturaRolavel = document.documentElement.scrollHeight - window.innerHeight;
      const fracao = paginaInicial / Math.max(1, paginas.length - 1);
      window.scrollTo({ top: Math.max(0, alturaRolavel * fracao) });
    });
    return () => window.cancelAnimationFrame(idQuadro);
  }, [modo, paginas.length, paginaInicial]);

  // Respeita `prefers-reduced-motion` para a rolagem automática (efeito
  // visual contínuo) — mostramos o controle desabilitado em vez de
  // simplesmente escondê-lo, para não parecer que o recurso "some" sem
  // explicação nenhuma.
  useEffect(() => {
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduzirMovimento(consulta.matches);
    function aoMudar(e: MediaQueryListEvent) {
      setReduzirMovimento(e.matches);
    }
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

  const paginaParaHistorico = modo === "paginado" ? paginaAtual : paginaEmVistaNoScroll;

  // Registra que o usuário começou a ler este capítulo assim que ele abre,
  // na página em que a leitura foi retomada (ou 1, se não havia progresso
  // salvo) — para que apareça em "Continuar lendo" mesmo se ele saltar
  // fora antes do efeito de progresso (abaixo) disparar. Usar
  // `paginaInicial` em vez de sempre "1" evita regredir o progresso salvo
  // (ex.: reabrir o mesmo capítulo na página 20 e fechar antes dos 2.5s do
  // efeito abaixo não deve zerar o progresso de volta para a página 1).
  useEffect(() => {
    void acaoSalvarProgresso({ mangaId: obraId, capituloId, paginaAtual: paginaInicial + 1 });
  }, [obraId, capituloId, paginaInicial]);

  // Persiste a posição de leitura com um pequeno atraso após cada mudança,
  // sem bloquear a UI e sem depender do usuário estar logado (o backend
  // ignora a chamada nesse caso).
  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      void acaoSalvarProgresso({
        mangaId: obraId,
        capituloId,
        paginaAtual: paginaParaHistorico + 1,
      });
    }, ATRASO_SALVAR_PROGRESSO_MS);

    return () => window.clearTimeout(temporizador);
  }, [obraId, capituloId, paginaParaHistorico]);

  // Rolagem automática só faz sentido no modo scroll contínuo — desliga
  // se o usuário trocar para o paginado.
  useEffect(() => {
    if (modo !== "vertical") setRolagemAutomatica(false);
  }, [modo]);

  // Loop de rolagem via requestAnimationFrame (mais suave e mais barato
  // na bateria/CPU do celular do que setInterval). O deslocamento é
  // calculado pelo tempo real decorrido entre frames, não por uma
  // contagem fixa de frames: telas de 90Hz/120Hz (comuns em celulares)
  // chamam requestAnimationFrame bem mais que 60x/s, e um incremento fixo
  // por frame rolaria visivelmente mais rápido nelas do que numa tela de
  // 60Hz. `velocidadeRolagem` é a unidade amigável "px por frame de
  // 60fps" — convertida aqui para px/s (× 60) e aplicada proporcional ao
  // tempo real (deltaSegundos), então o ritmo percebido é o mesmo em
  // qualquer tela. Para sozinho ao chegar ao fim da página.
  useEffect(() => {
    if (!rolagemAutomatica) return;

    let quadroAtivo = true;
    let idQuadro: number;
    let ultimoTimestamp: number | null = null;

    function proximoQuadro(timestamp: number) {
      if (!quadroAtivo) return;

      if (ultimoTimestamp !== null) {
        const deltaSegundos = (timestamp - ultimoTimestamp) / 1000;
        window.scrollBy({ top: velocidadeRolagem * 60 * deltaSegundos });
      }
      ultimoTimestamp = timestamp;

      const chegouAoFim =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

      if (chegouAoFim) {
        setRolagemAutomatica(false);
        return;
      }

      idQuadro = window.requestAnimationFrame(proximoQuadro);
    }

    idQuadro = window.requestAnimationFrame(proximoQuadro);

    return () => {
      quadroAtivo = false;
      window.cancelAnimationFrame(idQuadro);
    };
  }, [rolagemAutomatica, velocidadeRolagem]);

  function alternarEconomiaDeDados() {
    setEconomiaDeDados((atual) => {
      const novo = !atual;
      window.localStorage.setItem(CHAVE_ECONOMIA_DE_DADOS, novo ? "1" : "0");
      return novo;
    });
  }

  // No modo paginado, "próxima/anterior" no limite do capítulo avança
  // direto para o próximo/anterior em vez de ficar preso na última/
  // primeira página — antes disso o botão "Página →" simplesmente
  // desabilitava na última página, obrigando a voltar ao topo para achar
  // o link "Próximo capítulo" no rodapé.
  const irParaPaginaAnterior = useCallback(() => {
    if (modo !== "paginado") return;
    if (paginaAtual > 0) {
      setPaginaAtual((p) => p - 1);
    } else if (capituloAnteriorId) {
      router.push(`/obra/${encodeURIComponent(obraId)}/ler/${encodeURIComponent(capituloAnteriorId)}`);
    }
  }, [modo, paginaAtual, capituloAnteriorId, obraId, router]);

  const irParaProximaPagina = useCallback(() => {
    if (modo !== "paginado") return;
    if (paginaAtual < paginas.length - 1) {
      setPaginaAtual((p) => p + 1);
    } else if (proximoCapituloId) {
      router.push(`/obra/${encodeURIComponent(obraId)}/ler/${encodeURIComponent(proximoCapituloId)}`);
    }
  }, [modo, paginaAtual, paginas.length, proximoCapituloId, obraId, router]);

  // Navegação por teclado — só no modo paginado (no scroll contínuo, as
  // setas de rolagem do próprio navegador já cobrem a navegação).
  // Ignorada quando o foco está num campo de texto (ex.: o textarea de
  // comentários), para não "roubar" as setas/espaço de quem está digitando.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      const alvo = evento.target as HTMLElement | null;
      const digitando =
        alvo instanceof HTMLElement &&
        (alvo.tagName === "TEXTAREA" || alvo.tagName === "INPUT" || alvo.isContentEditable);
      if (digitando) return;

      if (evento.key === "ArrowRight" || evento.key === "PageDown" || evento.key === " ") {
        evento.preventDefault();
        irParaProximaPagina();
      } else if (evento.key === "ArrowLeft" || evento.key === "PageUp") {
        evento.preventDefault();
        irParaPaginaAnterior();
      }
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [irParaProximaPagina, irParaPaginaAnterior]);

  function alternarZoom() {
    setZoomAtivo((atual) => !atual);
  }

  function handleImagemCarregada(indice: number, img: HTMLImageElement) {
    if (img.naturalWidth === 0 || img.naturalHeight === 0) return;
    setPaginas((atual) =>
      atualizarPagina(atual, indice, {
        status: "ok",
        proporcao: `${img.naturalWidth} / ${img.naturalHeight}`,
      })
    );
  }

  function handleImagemComErro(indice: number) {
    setPaginas((atual) => {
      if (atual[indice]?.status === "erro") return atual;
      return atualizarPagina(atual, indice, { status: "erro" });
    });
  }

  // Reconexão real: pede à nossa própria rota um token novo do
  // MangaDex@Home para este capítulo (o token embutido na URL expira, o
  // que costuma acontecer no meio de uma rolagem longa) e substitui só a
  // URL daquela página específica — sem recarregar o site inteiro.
  const recarregarPagina = useCallback(
    async (indice: number) => {
      setPaginas((atual) => atualizarPagina(atual, indice, { status: "recarregando" }));

      try {
        const res = await fetch(
          `/api/capitulo/${encodeURIComponent(capituloId)}/paginas?obraId=${encodeURIComponent(obraId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error(`resposta ${res.status}`);
        }

        const dados: RespostaPaginas = await res.json();
        const listaAtualizada =
          economiaDeDados && dados.dataSaver.length === dados.data.length
            ? dados.dataSaver
            : dados.data;
        const novaUrl = listaAtualizada[indice];

        if (!novaUrl) {
          throw new Error("página ausente na resposta atualizada");
        }

        setPaginas((atual) =>
          atualizarPagina(atual, indice, { src: novaUrl, status: "carregando" })
        );
      } catch (err) {
        console.warn(
          `Não foi possível recarregar a página ${indice + 1} do capítulo ${capituloId}:`,
          err
        );
        setPaginas((atual) => atualizarPagina(atual, indice, { status: "erro" }));
      }
    },
    [capituloId, obraId, economiaDeDados]
  );

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="sticky top-0 z-10 flex flex-col gap-2 border-b border-ink-700 bg-ink-950/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/obra/${encodeURIComponent(obraId)}`}
            className="truncate text-sm text-paper-muted hover:text-paper"
          >
            ← {obraTitulo}
          </Link>
          <span className="shrink-0 font-mono text-sm text-paper">
            Cap. {numeroCapitulo}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={alternarEconomiaDeDados}
            aria-pressed={economiaDeDados}
            title="Reduz o tamanho das imagens para economizar dados móveis"
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
              economiaDeDados
                ? "border-jade text-jade"
                : "border-ink-700 text-paper-muted hover:text-paper"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                economiaDeDados ? "bg-jade" : "bg-ink-700"
              }`}
              aria-hidden
            />
            Economia de dados
          </button>
          <button
            onClick={alternarZoom}
            aria-pressed={zoomAtivo}
            title={zoomAtivo ? "Voltar ao tamanho normal" : "Aumentar o zoom das páginas"}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
              zoomAtivo ? "border-jade text-jade" : "border-ink-700 text-paper-muted hover:text-paper"
            }`}
          >
            {zoomAtivo ? "Zoom: ligado" : "Zoom"}
          </button>
          <button
            onClick={alternarModo}
            className="shrink-0 rounded-full border border-ink-700 px-3 py-1 text-xs text-paper-muted transition-colors hover:text-paper"
          >
            {modo === "vertical" ? "Modo paginado" : "Modo scroll"}
          </button>
        </div>
      </header>

      {modo === "vertical" && paginas.length > 0 && (
        <>
          {/* Indicador de progresso no modo scroll — o paginado já tem o
              "X / N" ao lado dos botões de página; o contínuo não tinha
              nenhum equivalente. */}
          <div className="fixed bottom-6 left-4 z-20 rounded-full border border-ink-700 bg-ink-950/95 px-3 py-1.5 font-mono text-xs text-paper-muted backdrop-blur">
            {paginaEmVistaNoScroll + 1} / {paginas.length}
          </div>

          <div className="fixed bottom-6 right-4 z-20 flex flex-col items-center gap-2">
            {rolagemAutomatica && (
              <div className="flex items-center gap-1 rounded-full border border-ink-700 bg-ink-950/95 px-1.5 py-1 backdrop-blur">
                <button
                  onClick={() =>
                    setVelocidadeRolagem((v) =>
                      Math.max(VELOCIDADE_ROLAGEM_MINIMA, v - PASSO_VELOCIDADE_ROLAGEM)
                    )
                  }
                  aria-label="Diminuir velocidade da rolagem"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-sm text-paper-muted transition-colors hover:text-paper"
                >
                  −
                </button>
                <span className="w-8 text-center font-mono text-xs text-paper-muted">
                  {velocidadeRolagem.toFixed(1)}x
                </span>
                <button
                  onClick={() =>
                    setVelocidadeRolagem((v) =>
                      Math.min(VELOCIDADE_ROLAGEM_MAXIMA, v + PASSO_VELOCIDADE_ROLAGEM)
                    )
                  }
                  aria-label="Aumentar velocidade da rolagem"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-sm text-paper-muted transition-colors hover:text-paper"
                >
                  +
                </button>
              </div>
            )}

            <button
              onClick={() => {
                if (reduzirMovimento) return;
                setRolagemAutomatica((atual) => !atual);
              }}
              disabled={reduzirMovimento}
              aria-pressed={rolagemAutomatica}
              aria-label={rolagemAutomatica ? "Pausar rolagem automática" : "Iniciar rolagem automática"}
              title={
                reduzirMovimento
                  ? "Rolagem automática desativada — seu sistema pede menos movimento na tela"
                  : rolagemAutomatica
                    ? "Pausar rolagem automática"
                    : "Rolagem automática"
              }
              className={`flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                rolagemAutomatica
                  ? "border-jade bg-jade text-ink-950"
                  : "border-ink-700 bg-ink-900/95 text-paper backdrop-blur hover:border-jade hover:text-jade"
              }`}
            >
              {rolagemAutomatica ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>
        </>
      )}

      {paginas.length === 0 ? (
        <p className="px-6 py-16 text-center text-paper-muted">
          Não foi possível carregar as páginas deste capítulo.
        </p>
      ) : modo === "vertical" ? (
        <div className="mx-auto flex max-w-2xl flex-col">
          {paginas.map((pagina, indice) => (
            <PaginaDoLeitor
              key={indice}
              pagina={pagina}
              indice={indice}
              numeroDeExibicao={indice + 1}
              variante="vertical"
              zoomAtivo={zoomAtivo}
              onCarregada={handleImagemCarregada}
              onErro={handleImagemComErro}
              onRecarregar={recarregarPagina}
              onAlternarZoom={alternarZoom}
            />
          ))}
        </div>
      ) : (
        <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-4">
          {(() => {
            const paginaExibida = paginas[paginaAtual];
            return (
              paginaExibida && (
                <PaginaDoLeitor
                  pagina={paginaExibida}
                  indice={paginaAtual}
                  numeroDeExibicao={paginaAtual + 1}
                  variante="paginado"
                  zoomAtivo={zoomAtivo}
                  onCarregada={handleImagemCarregada}
                  onErro={handleImagemComErro}
                  onRecarregar={recarregarPagina}
                  onAlternarZoom={alternarZoom}
                />
              )
            );
          })()}
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={irParaPaginaAnterior}
              disabled={paginaAtual === 0 && !capituloAnteriorId}
              className="rounded-card border border-ink-700 px-4 py-2 text-sm text-paper disabled:opacity-30"
            >
              ← Página
            </button>
            <span className="font-mono text-sm text-paper-muted">
              {paginaAtual + 1} / {paginas.length}
            </span>
            <button
              onClick={irParaProximaPagina}
              disabled={paginaAtual === paginas.length - 1 && !proximoCapituloId}
              className="rounded-card border border-ink-700 px-4 py-2 text-sm text-paper disabled:opacity-30"
            >
              Página →
            </button>
          </div>
        </div>
      )}

      <footer className="flex items-center justify-between border-t border-ink-700 px-4 py-4">
        {capituloAnteriorId ? (
          <Link
            href={`/obra/${encodeURIComponent(obraId)}/ler/${encodeURIComponent(capituloAnteriorId)}`}
            className="text-sm text-jade hover:text-jade-hover"
          >
            ← Capítulo anterior
          </Link>
        ) : (
          <span />
        )}
        {proximoCapituloId ? (
          <Link
            href={`/obra/${encodeURIComponent(obraId)}/ler/${encodeURIComponent(proximoCapituloId)}`}
            className="text-sm text-jade hover:text-jade-hover"
          >
            Próximo capítulo →
          </Link>
        ) : (
          <span />
        )}
      </footer>
    </div>
  );
}

interface PaginaDoLeitorProps {
  pagina: EstadoDaPagina;
  indice: number;
  numeroDeExibicao: number;
  variante: "vertical" | "paginado";
  zoomAtivo: boolean;
  onCarregada: (indice: number, img: HTMLImageElement) => void;
  onErro: (indice: number) => void;
  onRecarregar: (indice: number) => void;
  onAlternarZoom: () => void;
}

/**
 * Uma página do capítulo, com espaço reservado via `aspect-ratio` (evita
 * layout shift), skeleton enquanto carrega, e um estado de erro com botão
 * de reconexão — usado tanto no modo scroll (várias por vez) quanto no
 * paginado (uma por vez).
 */
function PaginaDoLeitor({
  pagina,
  indice,
  numeroDeExibicao,
  variante,
  zoomAtivo,
  onCarregada,
  onErro,
  onRecarregar,
  onAlternarZoom,
}: PaginaDoLeitorProps) {
  // Com zoom ligado, o container passa a rolar (`overflow-auto`) em vez
  // de recortar (`overflow-hidden`) — sem isso, a parte da imagem que
  // "cresce" além do tamanho do container ficaria simplesmente cortada e
  // inacessível, em vez de vira algo que o usuário pode rolar para ver.
  const classeContainer =
    variante === "vertical"
      ? `relative w-full bg-ink-900 ${zoomAtivo ? "overflow-auto" : "overflow-hidden"}`
      : `relative max-h-[85vh] w-auto rounded-card bg-ink-900 ${zoomAtivo ? "overflow-auto" : "overflow-hidden"}`;

  const podeMostrarImagem = pagina.status === "carregando" || pagina.status === "ok";

  return (
    <div className={classeContainer} style={{ aspectRatio: pagina.proporcao }}>
      {podeMostrarImagem && (
        // Imagem vinda de um host dinâmico da rede MangaDex@Home — ver
        // nota em lib/mangadex.ts sobre por que não usamos next/image aqui.
        // `key={pagina.src}` força o React a remontar a tag ao recarregar,
        // garantindo que o navegador refaça a requisição em vez de
        // reaproveitar a tentativa anterior (que falhou).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={pagina.src}
          src={pagina.src}
          alt={`Página ${numeroDeExibicao}`}
          loading={indice < 2 ? "eager" : "lazy"}
          onLoad={(e) => onCarregada(indice, e.currentTarget)}
          onError={() => onErro(indice)}
          onClick={onAlternarZoom}
          title={zoomAtivo ? "Toque para diminuir o zoom" : "Toque para aumentar o zoom"}
          className={`h-full object-contain transition-[opacity,transform] duration-300 ${
            zoomAtivo ? "w-auto scale-150 cursor-zoom-out" : "w-full cursor-zoom-in"
          } ${pagina.status === "ok" ? "opacity-100" : "opacity-0"}`}
        />
      )}

      {pagina.status === "carregando" && (
        <div className="absolute inset-0 animate-pulse bg-ink-800" aria-hidden />
      )}

      {pagina.status === "recarregando" && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink-900">
          <p className="text-sm text-paper-muted">Recarregando…</p>
        </div>
      )}

      {pagina.status === "erro" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-900 px-6 text-center">
          <p className="text-sm text-paper-muted">
            Não foi possível carregar a página {numeroDeExibicao}.
          </p>
          <button
            onClick={() => onRecarregar(indice)}
            className="rounded-full border border-ink-700 px-4 py-1.5 text-xs text-paper transition-colors hover:border-jade hover:text-jade"
          >
            ↻ Recarregar imagem
          </button>
        </div>
      )}
    </div>
  );
}
