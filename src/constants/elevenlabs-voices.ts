export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  description: string;
  group: string;
  preview_url?: string;
}

export const ELEVENLABS_VOICES: ElevenLabsVoice[] = [
  // Narração — Feminino PT-BR
  { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Calorosa e clara, ideal para audiobooks educacionais", group: "Narração — Feminino PT-BR" },
  { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Suave e expressiva, ótima para literatura infantil", group: "Narração — Feminino PT-BR" },
  { voice_id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", description: "Jovem e energética, ideal para público juvenil", group: "Narração — Feminino PT-BR" },
  // Narração — Masculino PT-BR
  { voice_id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Grave e profissional, ideal para narração adulta", group: "Narração — Masculino PT-BR" },
  { voice_id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Clara e bem-articulada, versátil para qualquer livro", group: "Narração — Masculino PT-BR" },
  { voice_id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", description: "Jovem e dinâmica, ótima para livros técnicos", group: "Narração — Masculino PT-BR" },
];

export const ELEVENLABS_MODELS = [
  { value: "eleven_multilingual_v2", label: "Multilingual v2 — Alta qualidade, 29 idiomas" },
  { value: "eleven_turbo_v2_5", label: "Turbo v2.5 — Baixa latência, alta qualidade" },
];
