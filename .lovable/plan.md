

# Editor Visual de Animações — Videobook

## Visao Geral

Criar um editor visual fullscreen (Dialog) para ajustar regioes detectadas pelo Gemini Vision. Inclui canvas interativo com retangulos arrastáveis/redimensionaveis, painel de controles, timeline de sincronizacao com audio, e preview em tempo real.

## Arquitetura de Componentes

```text
src/components/editor/
  AnimationEditorDialog.tsx    -- Dialog fullscreen (orquestrador)
  AnimationCanvas.tsx          -- Canvas 2D overlay sobre imagem com regioes interativas
  AnimationRegionPanel.tsx     -- Painel direito: controles da regiao selecionada + lista
  AnimationTimeline.tsx        -- Timeline horizontal com marcadores + player de audio
```

## Tipos e Constantes

Definir interface `Region` com campos: `id`, `label`, `type`, `x`, `y`, `width`, `height`, `animation_suggestion`, `priority`, `text_trigger`, `timestamp_start`, `timestamp_end`.

Cores por tipo de regiao:
- character: azul (#3B82F6)
- highlight_box: laranja (#F97316)
- title: verde (#22C55E)
- illustration: roxo (#A855F7)
- map: ciano (#06B6D4)
- diagram: amarelo (#EAB308)
- decorative: cinza (#6B7280)

## AnimationEditorDialog

- Recebe `page`, `onUpdate`, `open`, `onOpenChange`
- Carrega `video_regions` do page em estado local (deep clone)
- Layout: `grid grid-cols-[3fr_2fr]` dentro de DialogContent fullscreen
- Estado: `regions[]`, `selectedRegionId`, `pageBaseAnimation`, `suggestedTransition`, `drawingMode`
- "Salvar" → chama `onUpdate(page.id, { video_regions: JSON.stringify({regions, page_base_animation, suggested_transition}), video_status: 'configured' })`

## AnimationCanvas

- Container `relative` com `<img>` + overlay `<canvas>` posicionado absolute
- `useRef` para canvas e container
- `useEffect` para desenhar retangulos semitransparentes com cores por tipo + rotulo
- Mouse events para:
  - **Mover**: mousedown no interior → arrastar (delta x/y em proporcao)
  - **Redimensionar**: mousedown nas bordas/cantos (8 handles) → resize
  - **Selecionar**: click simples → `onSelect(regionId)`
  - **Criar**: se `drawingMode=true`, mousedown define ponto inicial, mousemove desenha, mouseup cria regiao
- Coordenadas normalizadas 0-1, convertidas para pixels do canvas

## AnimationRegionPanel

- Props: `regions`, `selectedId`, `onSelect`, `onUpdateRegion`, `onRemoveRegion`, `onAddRegion`, `pageBaseAnimation`, `suggestedTransition`, `onBaseAnimChange`, `onTransitionChange`
- Regiao selecionada: inputs para label, tipo (Select), animacao (Select), timestamp start/end (Input type=number step=0.1)
- Botao "Remover regiao" variant=destructive/outline
- Lista de todas regioes ordenadas por timestamp_start, clicaveis
- Selects para animacao de fundo e transicao de saida

## AnimationTimeline

- Props: `regions`, `selectedId`, `totalDuration`, `audioUrl`, `onSelect`, `onTimestampChange`
- Barra horizontal 100% width, height ~60px
- Para cada regiao: marcador arrastavel (div absolute posicionado por `(timestamp_start/totalDuration)*100%`)
- Arrastar marcador → recalcula timestamp_start
- `<audio ref>` com src=audioUrl
- Botoes play/pause, display do currentTime
- Linha vertical animada mostrando posicao do audio durante reproducao (requestAnimationFrame)

## Preview em Tempo Real

- Botao "Preview desta pagina" no painel
- Ao clicar: play audio + requestAnimationFrame loop
- Para cada frame: verificar quais regioes estao ativas (currentTime entre start/end)
- Aplicar animacao CSS/canvas correspondente (zoom, pan, spotlight = escurecer tudo menos a regiao, pulse border, fade in)
- Implementacao simplificada: highlight da regiao ativa com borda animada + leve zoom no canvas

## Integracao

- `VideoPageCard.tsx`: substituir `placeholderAction` do botao "Editar animacoes" por `setEditorOpen(true)`
- Renderizar `<AnimationEditorDialog>` no card

## Detalhes Tecnicos

- Canvas 2D puro (sem libs externas) para desenho de retangulos
- Hit-testing com coordenadas do mouse vs bounds de cada regiao
- Cursor dinamico: `move` no interior, `nwse-resize`/`nesw-resize`/`ew-resize`/`ns-resize` nas bordas
- Throttle de mousemove para performance
- Audio duration lido de `page.audiobook_audio_duration_seconds` ou do elemento `<audio>` `loadedmetadata`

## Ordem de Implementacao

1. Tipos/constantes + AnimationEditorDialog (shell com layout)
2. AnimationCanvas (desenho + interacao drag/resize/create)
3. AnimationRegionPanel (controles + lista)
4. AnimationTimeline (marcadores + player)
5. Preview simplificado
6. Integracao no VideoPageCard

