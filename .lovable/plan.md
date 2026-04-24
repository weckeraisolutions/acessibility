# Correção definitiva da consistência de ritmo nas narrações ElevenLabs

## Problema confirmado

Na página 14, com voz "Elena Vinter" e ritmo "Pausada", o áudio inicia em ritmo fluido (~educativo) e só a partir da metade adota o ritmo pausado. Os logs da edge function confirmam que `voice_settings.speed: 0.8` está sendo enviado, mas o modelo `eleven_multilingual_v2` está derivando a cadência ao longo da geração porque:

1. **Quebras de linha em listas** (Constelação:, Período:, Região:) fazem o modelo "resetar" a prosódia a cada item, ignorando parcialmente o `speed`.
2. **`stability: 0.92`** ainda permite variação prosódica suficiente para drift de ritmo.
3. **`style: 0.20`** introduz expressividade que compete com o `speed` solicitado.
4. **`similarity_boost: 0.90`** força o modelo a replicar a prosódia natural da voz original (que é fluida), neutralizando o `speed`.
5. O texto chega ao modelo com estrutura fragmentada que ele interpreta como múltiplos contextos prosódicos independentes.

## Correções no `supabase/functions/generate-audio/index.ts`

### 1. Normalização agressiva do texto antes do envio
Nova função `normalizeForElevenLabs(text)` aplicada **somente** ao input do ElevenLabs (não afeta Gemini):
- Colapsa todas as quebras de linha (`\n+`) em espaço único
- Converte `Palavra: ` (rótulos de lista) em `Palavra — ` para virar fluxo contínuo
- Garante pontuação terminal entre itens (`.` antes de cada novo `Constelação`, `Período`, etc.)
- Remove espaços duplicados
- Resultado: o modelo recebe um único parágrafo coeso, não uma lista fragmentada

### 2. Recalibrar `voice_settings` para travar o ritmo
```ts
voice_settings: {
  stability: 1.0,           // máximo — elimina variação prosódica
  similarity_boost: 0.75,   // reduz a "puxada" para a prosódia natural da voz
  style: 0.0,               // zero estilo — sem expressividade competindo com speed
  use_speaker_boost: false, // remove boost que pode acelerar finais de frase
  speed: <mapeado>,         // 0.80 pausada / 0.92 educativo / 1.00 fluente
}
```

### 3. Reduzir `MAX_CHUNK` de 3500 → 1800 caracteres
Chunks menores garantem que `voice_settings` seja reavaliado com mais frequência, mantendo o ritmo uniforme em todo o áudio. Com 1800 chars, mesmo textos longos terão múltiplos chunks pequenos onde o `speed` é aplicado de forma consistente.

### 4. Remover **completamente** `previous_text` e `next_text` para qualquer ritmo não-fluente
Hoje só removemos para "pausada". O ritmo "educativo" (0.92) também sofre contaminação prosódica do contexto anterior. Regra nova:
- `fluente` (1.00): mantém contexto (cadência natural)
- `educativo` (0.92): **remove** contexto
- `pausada` (0.80): **remove** contexto (já era assim)

### 5. Adicionar instrução prosódica inline no início de cada chunk
Prefixar cada chunk com uma marca contextual curta que o `eleven_multilingual_v2` interpreta como pista de ritmo:
- `pausada`: prefixo `"... "` (reticências longas) — induz cadência lenta
- `educativo`: prefixo `". "` — pausa curta neutra
- `fluente`: sem prefixo

Isso é uma técnica documentada para `eleven_multilingual_v2` quando `voice_settings.speed` sozinho não basta.

## Validação
- Redeploy da edge function `generate-audio`.
- Testar regenerando a narração da página 14 com Elena Vinter + Pausada.
- Verificar nos logs que `[ElevenLabs] chunk N/M voice_settings` mostra `stability:1, style:0, similarity_boost:0.75, speed:0.8` para todos os chunks.
- Confirmar auditivamente que o ritmo pausado se mantém do primeiro ao último segundo.

## O que NÃO muda
- Pipeline Gemini (intacto).
- Estrutura de tabelas, buckets, signed URLs, cache-buster.
- UI de NarrationBlock / AudioPageCard / GlobalConfigPanel.
- Lógica de Videobook, capítulos, export.
- Qualquer outro módulo do sistema.

## Ordem de implementação
1. Editar `supabase/functions/generate-audio/index.ts` com as 5 correções acima.
2. Redeploy via `supabase--deploy_edge_functions`.
3. Confirmar logs limpos e pedir ao usuário para regerar a narração problemática.
