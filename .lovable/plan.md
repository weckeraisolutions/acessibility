

# Editor Completo — /projeto/:id

## Visão Geral

Construir o editor de projeto completo com 3 abas (Audiobook, Audiodescrição, Videobook), header com nome editável inline, navegação de páginas em pares, cards de página com controles de texto/áudio/vídeo, painéis de configuração global colapsáveis, e auto-save com debounce.

## Arquitetura de Componentes

```text
src/pages/ProjectDetail.tsx          (orquestrador principal)
src/components/editor/
  EditorHeader.tsx                   (header fixo: voltar, nome editável, badges)
  EditorTabs.tsx                     (wrapper das 3 abas)
  GlobalConfigPanel.tsx              (painel colapsável de estilo/voz global)
  PageNavigator.tsx                  (navegação par anterior/próximo par)
  AudioPageCard.tsx                  (card de página para Audiobook e Audiodescrição)
  VideoPageCard.tsx                  (card de página para Videobook)
  VideoGlobalPanel.tsx               (config global do videobook: formato, transição, resolução)
  ExportFooter.tsx                   (seção de exportação compartilhada)
src/hooks/
  useProjectEditor.ts               (fetch projeto + páginas, estados, auto-save)
  useDebounce.ts                     (debounce genérico)
```

## Detalhes Técnicos

### 1. ProjectDetail.tsx — Orquestrador
- Busca projeto por ID e páginas ordenadas por `page_number`
- Se `total_pages === 0 && processing_status === 'pending'`: mostra tela "Processando..."
- Senão: renderiza `EditorHeader`, `Tabs` (Audiobook / Audiodescrição / Videobook), `ExportFooter`
- Estado global: `project`, `pages[]`, `currentPairIndex`, `activeTab`, `saving`

### 2. EditorHeader
- Botão "← Dashboard" à esquerda
- Nome editável inline (clique → input, blur/enter → salva via supabase update)
- Badges à direita: contadores calculados das páginas (extraídas, áudios gerados, aprovados)
- Indicador "Salvo ✓" temporário após auto-save

### 3. GlobalConfigPanel (Audiobook e Audiodescrição)
- `Collapsible` expandido por padrão
- Textarea para estilo de narração (salva em `audiobook_global_style` ou `audiodesc_global_style` do projeto)
- Select com 28 vozes (Zephyr, Puck, Charon, etc.) — salva em `*_global_voice`
- Botão "Extrair todos os textos" (placeholder — chama toast "será implementado")
- Progresso e rate limit visíveis condicionalmente

### 4. PageNavigator
- Calcula pares: `[[p1,p2], [p3,p4], ...]`
- Botões anterior/próximo, indicador "Par X de Y"
- Responsivo: 2 colunas desktop, 1 coluna mobile

### 5. AudioPageCard (reutilizado para Audiobook e Audiodescrição)
- Props: `page`, `mode: 'audiobook' | 'audiodesc'`, `globalVoice`, `globalStyle`, `onUpdate`
- Imagem da página com badge de status colorido (pendente/texto extraído/áudio gerado/aprovado)
- Textarea editável com debounce 2s → auto-save no campo `audiobook_text` ou `audiodesc_text`
- Botão "Extrair esta página" (placeholder)
- Select de voz por página (herda global, badge "Personalizada" se diferente)
- Input de estilo por página (placeholder "Herda configuração global se vazio")
- Botão "Gerar Áudio" (habilitado se texto existe, placeholder)
- Player HTML5 `<audio>` (visível se audio_url existe)
- Botões Download MP3, Aprovar, Regerar (visíveis após áudio)

### 6. VideoPageCard
- Preview da imagem com badge de status (pendente/regiões/configurado/exportado)
- Botão "Detectar regiões" e "Editar animações" (placeholders)
- Select de transição de saída por página

### 7. VideoGlobalPanel
- Textarea estilo visual global
- Selects: transição padrão, formato, resolução
- Botões: detectar regiões em todas, preview, exportar MP4
- Aviso amarelo sobre tempo de exportação

### 8. ExportFooter
- Select de capítulo/seção
- Botões de download ZIP / MP4

### 9. useProjectEditor hook
- Fetch projeto e páginas do Supabase
- Funções: `updateProject(fields)`, `updatePage(pageId, fields)` com debounce
- Estado `saving` para indicador visual

### 10. useDebounce hook
- Debounce de 2 segundos para auto-save de textos

### 11. Lista de vozes (constante compartilhada)
- Array de 28 objetos `{ value, label, description }` em arquivo de constantes `src/constants/voices.ts`

## Fluxo de Dados

1. Ao montar: busca projeto + páginas
2. Edições de texto → debounce 2s → `supabase.from('pages').update()`
3. Edições de config global → `supabase.from('projects').update()`
4. Nome do projeto → update imediato ao confirmar
5. Indicador "Salvo" no header por 2s após qualquer save

## Implementação

Será dividido em 5 etapas:
1. Hook `useProjectEditor` + `useDebounce` + constantes de vozes
2. `EditorHeader` + `ProjectDetail` (orquestrador com loading/processing states)
3. `GlobalConfigPanel` + `AudioPageCard` + `PageNavigator` (abas Audiobook/Audiodescrição)
4. `VideoGlobalPanel` + `VideoPageCard` (aba Videobook)
5. `ExportFooter` (rodapé compartilhado)

