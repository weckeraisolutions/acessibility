export interface Region {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  animation_suggestion: string;
  priority: number;
  text_trigger: string;
  timestamp_start: number;
  timestamp_end: number;
}

export const REGION_COLORS: Record<string, string> = {
  character: "#3B82F6",
  highlight_box: "#F97316",
  title: "#22C55E",
  illustration: "#A855F7",
  map: "#06B6D4",
  diagram: "#EAB308",
  decorative: "#6B7280",
};

export const REGION_TYPE_LABELS: Record<string, string> = {
  character: "Personagem",
  highlight_box: "Box de destaque",
  title: "Título",
  illustration: "Ilustração",
  map: "Mapa",
  diagram: "Diagrama",
  decorative: "Decorativo",
};

export const ANIMATION_OPTIONS = [
  { value: "zoom_in", label: "Zoom In suave" },
  { value: "zoom_out", label: "Zoom Out suave" },
  { value: "ken_burns", label: "Ken Burns (zoom+pan)" },
  { value: "pan_right", label: "Pan para direita" },
  { value: "pan_left", label: "Pan para esquerda" },
  { value: "spotlight", label: "Spotlight (destaque)" },
  { value: "pulse_border", label: "Contorno pulsante" },
  { value: "fade_in", label: "Fade in" },
  { value: "none", label: "Sem animação" },
];

export const BASE_ANIMATION_OPTIONS = [
  { value: "ken_burns", label: "Ken Burns" },
  { value: "zoom_in", label: "Zoom In" },
  { value: "zoom_out", label: "Zoom Out" },
  { value: "pan_right", label: "Pan direita" },
  { value: "pan_left", label: "Pan esquerda" },
  { value: "static", label: "Estático" },
];

export const TRANSITION_OPTIONS = [
  { value: "fade", label: "Fade" },
  { value: "slide_left", label: "Slide esquerda" },
  { value: "slide_right", label: "Slide direita" },
  { value: "page_flip", label: "Virar página" },
  { value: "cut", label: "Corte direto" },
];
