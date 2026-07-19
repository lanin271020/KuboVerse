# Racional de design

## Paleta — "tinta e selo"
Em vez do preto puro genérico, o fundo é um preto levemente azulado
(`#0B0C10`), como papel escurecido. O acento primário (`hanko`, `#B23A2E`)
é inspirado nos selos de carimbo (hanko/inkan) usados em capas e
publicações do leste asiático — dá uma assinatura visual ligada ao
universo do produto, em vez de um vermelho ou terracota genérico.
O acento secundário (`jade`, `#3FA796`) marca estados "vivos" do site:
capítulo novo, links ativos.

## Tipografia
- **Display** (`Space Grotesk`): geométrica, com leve caráter técnico —
  usada em títulos e nos selos de tipo de obra.
- **Corpo** (`Inter`): neutra e legível para sinopses e textos longos.
- **Mono** (`IBM Plex Mono`): reservada a metadados (números de capítulo,
  datas, selo "novo") para diferenciar dado de conteúdo editorial.

## Elemento de assinatura
O selo circular estilo "hanko" no canto do card, indicando o tipo da obra
(Manhwa/Mangá/Manhua), é o elemento memorável do catálogo — substitui a
badge retangular genérica por algo que remete ao objeto físico (carimbo
de autenticidade), coerente com o tema do produto.

## Próximos ajustes recomendados antes de ir para produção
- Definir a fonte real via `next/font` em vez de apenas declarar no CSS.

## Resolvido
- Tipo da obra (manhwa/mangá/manhua) agora é inferido a partir de
  `originalLanguage` da MangaDex, com fallback documentado em
  `lib/mangadex.ts`.
- Data do capítulo mais recente pt-BR agora é buscada de verdade
  (endpoint `/chapter`), em lotes de 5 para respeitar o rate limit.
- Paginação "carregar mais" no catálogo e paginação real da lista de
  capítulos (acima de 100).
- **Bug crítico corrigido**: `buscarObraPorId` não tinha tratamento de
  erro próprio — qualquer falha (404, timeout, MangaDex fora do ar)
  derrubava a página inteira com erro genérico do Next.js, em vez de
  mostrar o 404 estilizado ou uma tela de "tente novamente". Agora a
  função distingue 404 real (obra não existe → `null`) de falha
  temporária (propaga o erro de forma documentada), e as páginas de
  detalhes e do leitor tratam os dois casos com telas apropriadas.
