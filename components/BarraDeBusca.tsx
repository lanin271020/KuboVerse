"use client";

import { useEffect, useId, useState } from "react";
import type { CatalogoResponse } from "@/lib/types";

const ATRASO_DEBOUNCE_MS = 400;
const TAMANHO_MINIMO_TERMO = 2;
// Mesmo teto aplicado no servidor (ver app/api/busca/route.ts) — reforçado
// aqui via `maxLength` para o usuário já ver o limite no próprio campo,
// em vez de só descobrir depois que a busca foi truncada silenciosamente.
const TAMANHO_MAXIMO_TERMO = 100;

export function BarraDeBusca() {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<CatalogoResponse | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const termoLimpo = termo.trim();

    if (termoLimpo.length < TAMANHO_MINIMO_TERMO) {
      setResultados(null);
      setErro(false);
      setCarregando(false);
      return;
    }

    const controller = new AbortController();
    setCarregando(true);
    setErro(false);

    const debounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/busca?q=${encodeURIComponent(termoLimpo)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`busca respondeu ${res.status}`);
        const json: CatalogoResponse = await res.json();
        setResultados(json);
      } catch (err) {
        // Uma busca cancelada (AbortError) não é um erro real — só significa
        // que o usuário já digitou outra coisa antes desta responder.
        if ((err as Error).name !== "AbortError") {
          console.error("Falha ao buscar:", err);
          setErro(true);
        }
      } finally {
        // Condição de corrida real encontrada aqui: sem este `if`, uma
        // busca ANTIGA e já abortada ainda chega a este `finally` (o
        // abort() rejeita a promise de forma assíncrona) e desliga
        // `carregando` — mesmo que, nesse meio-tempo, um novo efeito já
        // tenha ligado `carregando` de novo para o termo MAIS RECENTE.
        // Resultado visível: o spinner "pisca" para false no meio de uma
        // busca ainda em andamento. Só a busca que não foi abortada (ou
        // seja, a mais recente) deve ter permissão de desligar o loading.
        if (!controller.signal.aborted) {
          setCarregando(false);
        }
      }
    }, ATRASO_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [termo]);

  const termoNormalizado = termo.trim();
  const termoValido = termoNormalizado.length >= TAMANHO_MINIMO_TERMO;
  const termoMuitoCurto = termoNormalizado.length > 0 && !termoValido;
  const totalResultados = resultados
    ? resultados.traduzidas.length + resultados.semTraducao.length
    : 0;
  const mostrarPainel = termoValido || termoMuitoCurto;
  const idListbox = useId();

  return (
    <div className="relative">
      <input
        type="text"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Buscar obra..."
        aria-label="Buscar obra"
        maxLength={TAMANHO_MAXIMO_TERMO}
        role="combobox"
        aria-expanded={mostrarPainel}
        aria-controls={idListbox}
        aria-autocomplete="list"
        autoComplete="off"
        className="w-full rounded-card border border-ink-700 bg-ink-900 px-4 py-2.5 text-paper placeholder:text-paper-muted focus:border-jade focus:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
      />

      {mostrarPainel && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-card border border-ink-700 bg-ink-900 shadow-lg">
          {termoMuitoCurto && (
            <p className="px-4 py-3 text-sm text-paper-muted">
              Digite ao menos {TAMANHO_MINIMO_TERMO} caracteres para buscar.
            </p>
          )}

          {termoValido && carregando && (
            <p className="px-4 py-3 text-sm text-paper-muted" role="status">
              Buscando…
            </p>
          )}

          {termoValido && !carregando && erro && (
            <p className="px-4 py-3 text-sm text-hanko" role="alert">
              Não foi possível buscar agora. Tente novamente.
            </p>
          )}

          {termoValido && !carregando && !erro && resultados && totalResultados === 0 && (
            <p className="px-4 py-3 text-sm text-paper-muted">
              Nenhuma obra encontrada.
            </p>
          )}

          {termoValido && !carregando && !erro && resultados && totalResultados > 0 && (
            <ul id={idListbox} role="listbox" aria-label="Resultados da busca" className="max-h-96 overflow-y-auto">
              {resultados.traduzidas.map((obra) => (
                <li key={obra.id} role="option" aria-selected={false}>
                  <a
                    href={`/obra/${encodeURIComponent(obra.id)}`}
                    className="block truncate px-4 py-2.5 text-sm text-paper hover:bg-ink-800"
                  >
                    {obra.titulo}
                  </a>
                </li>
              ))}
              {resultados.semTraducao.map((obra) => (
                <li key={obra.id} role="option" aria-selected={false}>
                  <a
                    href={`/obra/${encodeURIComponent(obra.id)}`}
                    className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-paper-muted hover:bg-ink-800"
                  >
                    <span className="truncate">{obra.titulo}</span>
                    <span className="shrink-0 text-xs">sem trad. BR</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
