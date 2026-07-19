"use client";

import { useEffect, useState } from "react";
import { ContinuarLendo } from "@/components/ContinuarLendo";
import type { ItemContinuarLendo } from "@/services/history";

/**
 * Busca "Continuar lendo" no client, depois da montagem, via
 * /api/continuar-lendo — ver o comentário nessa rota sobre por que essa
 * busca não pode mais rodar direto na árvore de render da Home (Server
 * Component). Não renderiza nada enquanto carrega/se vazio: não há
 * usuário logado sem histórico nenhum, então a ausência da seção não é
 * visível como um "buraco" na página.
 */
export function ContinuarLendoContainer() {
  const [itens, setItens] = useState<ItemContinuarLendo[]>([]);

  useEffect(() => {
    let cancelado = false;

    fetch("/api/continuar-lendo")
      .then((res) => (res.ok ? res.json() : { itens: [] }))
      .then((dados: { itens?: ItemContinuarLendo[] }) => {
        if (!cancelado) setItens(dados.itens ?? []);
      })
      .catch((err) => {
        console.error("Falha ao carregar 'Continuar lendo':", err);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return <ContinuarLendo itens={itens} />;
}
