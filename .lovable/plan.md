## Objetivo
Eliminar definitivamente o travamento "Reorganizando layout..." no módulo Videobook, corrigir o erro `Invalid width or height` do page-flip, sanar o warning do `HighResPreparationDialog`, e deixar o player pronto para escala usando o wrapper oficial `react-pageflip`.

## Causa raiz identificada
1. `new PageFlip()` é chamado com `width=0/height=0` quando o container ainda não foi medido pelo browser (race entre layout do CSS grid e o `useEffect`). A exceção lançada não é capturada → `setReinitializing(false)` nunca executa → overlay fica para sempre.
2. Guarda `lastImgsKeyRef` cria deadlock: marca a key antes de saber se o init terminou. Em re-render/StrictMode, próximas tentativas são ignoradas.
3. `HighResPreparationDialog` recebe ref implícita do Radix em uma render path que dispara warning.
4. Configuração do PageFlip mistura `size:"stretch"` + `width/height` fixos + `autoSize` (contraditório).
5. Sem `ResizeObserver` → não recalcula em mudanças do layout.

## Implementação

### 1. Instalar dependência
- `bun add react-pageflip` (wrapper React oficial e mantido da mesma lib base, com lifecycle correto, tipagem TS e ref API).

### 2. Reescrever `src/components/videobook/VideobookPlayer.tsx`
- Substituir uso vanilla de `PageFlip` por `<HTMLFlipBook>` de `react-pageflip`.
- Estado-máquina explícito: `idle | preloading | ready | error`.
- Pré-carregar todas as imagens com `Promise.all` antes de montar o componente.
- Usar `ResizeObserver` com debounce (150ms) para recalcular `width/height` quando o container muda.
- **Guarda dimensional**: só renderiza `<HTMLFlipBook>` quando `width >= 200 && height >= 280`.
- Try/catch + `finally` em todos os pontos de risco — overlay sempre desaparece.
- Estado `error` mostra botão "Tentar novamente".
- Manter `useImperativeHandle` expondo a mesma API pública (`getCurrentTime`, `getTotalDuration`, `goToPage`, `flipNext`, `getContainer`) — zero breaking change para consumidores.
- Toggle de layout: muda apenas `usePortrait` prop, sem destruir/recriar manualmente — o wrapper cuida.
- Listeners de áudio reescritos com cleanup correto e guard contra instância stale.
- Logs `console.debug("[VideobookPlayer]", ...)` para diagnóstico futuro.

### 3. Corrigir `src/components/videobook/HighResPreparationDialog.tsx`
- Garantir estrutura limpa do `DialogContent` (envolver `DialogHeader`/`DialogTitle`/`DialogDescription` corretamente, remover qualquer ref implícita).
- Verificar se algum prop está vazando ref para `DialogHeader` (componente function sem forwardRef). Ajustar import/estrutura.

### 4. Ajustar `src/components/videobook/ChapterEditorView.tsx`
- Garantir `min-h-[600px]` E `min-w-[320px]` no container do player (`lg:col-span-7`), evitando width:0 em transições do grid.
- Remover qualquer wrapper que possa colapsar dimensões durante mount.

### 5. QA pós-implementação
- Build TypeScript limpo (`bunx tsc --noEmit`).
- Verificar console sem warnings de ref ou erros de page-flip.
- Testar toggle de layout 1↔2 páginas várias vezes seguidas.
- Testar resize da janela com flipbook ativo.
- Testar em viewport mobile (911px atual do usuário).

## Arquivos afetados
- `package.json` (+ react-pageflip)
- `src/components/videobook/VideobookPlayer.tsx` (reescrita)
- `src/components/videobook/HighResPreparationDialog.tsx` (ajuste pequeno)
- `src/components/videobook/ChapterEditorView.tsx` (CSS dimensional)

## Garantias
- Zero breaking change na API pública do `VideobookPlayer` (ChapterEditorView e exportadores continuam funcionando).
- Overlay "Reorganizando layout" terá timeout máximo garantido pela state machine.
- Todas as exceções no init do flipbook serão capturadas e exibidas como erro recuperável.
- Pronto para escala: lib mantida, lifecycle React-nativo, sem hacks de setTimeout.

## Fora de escopo (esta iteração)
- Implementação do seek funcional no Slider de progresso (atualmente noop).
- Suporte a vídeo de intérprete sobreposto ao flipbook (já existe em painel separado).
