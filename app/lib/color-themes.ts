export type ColorThemeId =
  | "default"
  | "ocean"
  | "forest"
  | "molokai"
  | "gruvbox"
  | "sonokai"
  | "onedark";

export type EventColor = { name: string; value: string };

export const EVENT_COLOR_PALETTES: Record<ColorThemeId, EventColor[]> = {
  default: [
    { name: "다홍", value: "#ff6b9d" },
    { name: "주황", value: "#ffa94d" },
    { name: "핑크", value: "#C71585" },
    { name: "블루", value: "#4CC9FE" },
    { name: "인디고", value: "#4B0082" },
    { name: "네이비", value: "#000080" },
    { name: "보라", value: "#C4A5FE" },
    { name: "틸", value: "#008080" },
    { name: "연두", value: "#00FF7F" },
    { name: "연갈색", value: "#B76C4B" },
    { name: "노랑", value: "#FFFF00" },
  ],
  ocean: [
    { name: "코랄", value: "#fb7185" },
    { name: "샌드", value: "#fbbf77" },
    { name: "민트", value: "#5eead4" },
    { name: "하늘", value: "#38bdf8" },
    { name: "딥블루", value: "#1d4ed8" },
    { name: "보라", value: "#a855f7" },
    { name: "라일락", value: "#c4b5fd" },
    { name: "딥그린", value: "#047857" },
  ],
  forest: [
    { name: "포레스트 그린", value: "#16a34a" },
    { name: "라임", value: "#84cc16" },
    { name: "올리브", value: "#4d7c0f" },
    { name: "브라운", value: "#92400e" },
    { name: "오렌지", value: "#f97316" },
    { name: "골드", value: "#eab308" },
    { name: "모스", value: "#166534" },
    { name: "틸", value: "#0f766e" },
  ],
  molokai: [
    { name: "사이언", value: "#66D9EF" },
    { name: "핑크", value: "#F92672" },
    { name: "라임", value: "#A6E22E" },
    { name: "오렌지", value: "#FD971F" },
    { name: "보라", value: "#AE81FF" },
  ],
  gruvbox: [
    { name: "그루브 오렌지", value: "#fe8019" },
    { name: "그루브 레드", value: "#fb4934" },
    { name: "그루브 옐로", value: "#fabd2f" },
    { name: "그루브 블루", value: "#83a598" },
    { name: "그루브 퍼플", value: "#d3869b" },
    { name: "그루브 그린", value: "#b8bb26" },
  ],
  sonokai: [
    { name: "소노 그린", value: "#a7df78" },
    { name: "소노 블루", value: "#7fbbb3" },
    { name: "소노 퍼플", value: "#d699b6" },
    { name: "소노 오렌지", value: "#e69875" },
  ],
  onedark: [
    { name: "원다크 블루", value: "#61afef" },
    { name: "원다크 그린", value: "#98c379" },
    { name: "원다크 퍼플", value: "#c678dd" },
    { name: "원다크 오렌지", value: "#d19a66" },
    { name: "원다크 레드", value: "#e06c75" },
  ],
};

const DEFAULT_THEME_ID: ColorThemeId = "default";

export function getCurrentColorThemeId(): ColorThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  const saved = window.localStorage.getItem("gbti_color_theme") as ColorThemeId | null;
  if (saved && saved in EVENT_COLOR_PALETTES) return saved;
  return DEFAULT_THEME_ID;
}

export function getCurrentEventColorPalette(): EventColor[] {
  const id = getCurrentColorThemeId();
  return EVENT_COLOR_PALETTES[id] ?? EVENT_COLOR_PALETTES[DEFAULT_THEME_ID];
}