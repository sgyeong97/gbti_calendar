export type ColorThemeId =
  | "default"
  | "ocean"
  | "forest"
  | "molokai"
  | "gruvbox"
  | "sonokai"
  | "onedark";

// DB 및 프론트에서 사용하는 색상 ID
export type ColorId =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "teal"
  | "brown"
  | "lime";

export type EventColor = {
  id: ColorId;
  name: string;
  hex: string;
};

// 라이트 모드용 팔레트
export const EVENT_COLOR_PALETTES: Record<ColorThemeId, EventColor[]> = {
  default: [
    { id: "red", name: "레드", hex: "#ff6b9d" },
    { id: "orange", name: "오렌지", hex: "#ffa94d" },
    { id: "yellow", name: "옐로우", hex: "#ffd93d" },
    { id: "green", name: "그린", hex: "#00FF7F" },
    { id: "blue", name: "블루", hex: "#4CC9FE" },
    { id: "purple", name: "퍼플", hex: "#C4A5FE" },
    { id: "pink", name: "핑크", hex: "#C71585" },
    { id: "teal", name: "틸", hex: "#008080" },
    { id: "brown", name: "브라운", hex: "#B76C4B" },
    { id: "lime", name: "라임", hex: "#84cc16" },
  ],
  ocean: [
    { id: "red", name: "레드", hex: "#fb7185" },
    { id: "orange", name: "오렌지", hex: "#fbbf77" },
    { id: "yellow", name: "옐로우", hex: "#facc15" },
    { id: "green", name: "그린", hex: "#5eead4" },
    { id: "blue", name: "블루", hex: "#38bdf8" },
    { id: "purple", name: "퍼플", hex: "#a855f7" },
    { id: "pink", name: "핑크", hex: "#f472b6" },
    { id: "teal", name: "틸", hex: "#0f766e" },
    { id: "brown", name: "브라운", hex: "#92400e" },
    { id: "lime", name: "라임", hex: "#84cc16" },
  ],
  forest: [
    { id: "red", name: "레드", hex: "#f97373" },
    { id: "orange", name: "오렌지", hex: "#f97316" },
    { id: "yellow", name: "옐로우", hex: "#eab308" },
    { id: "green", name: "그린", hex: "#16a34a" },
    { id: "blue", name: "블루", hex: "#22c1c3" },
    { id: "purple", name: "퍼플", hex: "#a855f7" },
    { id: "pink", name: "핑크", hex: "#f9a8d4" },
    { id: "teal", name: "틸", hex: "#0f766e" },
    { id: "brown", name: "브라운", hex: "#92400e" },
    { id: "lime", name: "라임", hex: "#84cc16" },
  ],
  molokai: [
    { id: "red", name: "레드", hex: "#F92672" },
    { id: "orange", name: "오렌지", hex: "#FD971F" },
    { id: "yellow", name: "옐로우", hex: "#E6DB74" },
    { id: "green", name: "그린", hex: "#A6E22E" },
    { id: "blue", name: "블루", hex: "#66D9EF" },
    { id: "purple", name: "퍼플", hex: "#AE81FF" },
    { id: "pink", name: "핑크", hex: "#ff79c6" },
    { id: "teal", name: "틸", hex: "#2AA198" },
    { id: "brown", name: "브라운", hex: "#b5885e" },
    { id: "lime", name: "라임", hex: "#b8e994" },
  ],
  gruvbox: [
    { id: "red", name: "레드", hex: "#fb4934" },
    { id: "orange", name: "오렌지", hex: "#fe8019" },
    { id: "yellow", name: "옐로우", hex: "#fabd2f" },
    { id: "green", name: "그린", hex: "#b8bb26" },
    { id: "blue", name: "블루", hex: "#83a598" },
    { id: "purple", name: "퍼플", hex: "#d3869b" },
    { id: "pink", name: "핑크", hex: "#ff9ead" },
    { id: "teal", name: "틸", hex: "#8ec07c" },
    { id: "brown", name: "브라운", hex: "#b57614" },
    { id: "lime", name: "라임", hex: "#d8fb71" },
  ],
  sonokai: [
    { id: "red", name: "레드", hex: "#e82424" },
    { id: "orange", name: "오렌지", hex: "#e69875" },
    { id: "yellow", name: "옐로우", hex: "#e0c080" },
    { id: "green", name: "그린", hex: "#a7df78" },
    { id: "blue", name: "블루", hex: "#7fbbb3" },
    { id: "purple", name: "퍼플", hex: "#d699b6" },
    { id: "pink", name: "핑크", hex: "#ffb4e2" },
    { id: "teal", name: "틸", hex: "#2d5b69" },
    { id: "brown", name: "브라운", hex: "#7a5d3b" },
    { id: "lime", name: "라임", hex: "#c3e88d" },
  ],
  onedark: [
    { id: "red", name: "레드", hex: "#e06c75" },
    { id: "orange", name: "오렌지", hex: "#d19a66" },
    { id: "yellow", name: "옐로우", hex: "#e5c07b" },
    { id: "green", name: "그린", hex: "#98c379" },
    { id: "blue", name: "블루", hex: "#61afef" },
    { id: "purple", name: "퍼플", hex: "#c678dd" },
    { id: "pink", name: "핑크", hex: "#ff79c6" },
    { id: "teal", name: "틸", hex: "#56b6c2" },
    { id: "brown", name: "브라운", hex: "#be5046" },
    { id: "lime", name: "라임", hex: "#b9e75b" },
  ],
};

const DEFAULT_THEME_ID: ColorThemeId = "default";

// 다크 모드용 팔레트 (배경이 어두울 때도 잘 보이도록 한 단계씩 더 밝게/쨍하게 조정)
export const EVENT_COLOR_PALETTES_DARK: Record<ColorThemeId, EventColor[]> = {
  default: [
    { id: "red", name: "레드", hex: "#ff8dad" },
    { id: "orange", name: "오렌지", hex: "#ffc073" },
    { id: "yellow", name: "옐로우", hex: "#ffe066" },
    { id: "green", name: "그린", hex: "#5cf2a2" },
    { id: "blue", name: "블루", hex: "#5fd4ff" },
    { id: "purple", name: "퍼플", hex: "#d1b3ff" },
    { id: "pink", name: "핑크", hex: "#ff8fd1" },
    { id: "teal", name: "틸", hex: "#26c6da" },
    { id: "brown", name: "브라운", hex: "#d18d5c" },
    { id: "lime", name: "라임", hex: "#a3e635" },
  ],
  ocean: [
    { id: "red", name: "레드", hex: "#ff9aa5" },
    { id: "orange", name: "오렌지", hex: "#ffcf91" },
    { id: "yellow", name: "옐로우", hex: "#fde68a" },
    { id: "green", name: "그린", hex: "#7ff7dc" },
    { id: "blue", name: "블루", hex: "#60e1ff" },
    { id: "purple", name: "퍼플", hex: "#c4a5ff" },
    { id: "pink", name: "핑크", hex: "#f9a8d4" },
    { id: "teal", name: "틸", hex: "#22d3ee" },
    { id: "brown", name: "브라운", hex: "#e0a36a" },
    { id: "lime", name: "라임", hex: "#bef264" },
  ],
  forest: [
    { id: "red", name: "레드", hex: "#fb7185" },
    { id: "orange", name: "오렌지", hex: "#fdba74" },
    { id: "yellow", name: "옐로우", hex: "#facc15" },
    { id: "green", name: "그린", hex: "#22c55e" },
    { id: "blue", name: "블루", hex: "#2dd4bf" },
    { id: "purple", name: "퍼플", hex: "#e879f9" },
    { id: "pink", name: "핑크", hex: "#f472b6" },
    { id: "teal", name: "틸", hex: "#14b8a6" },
    { id: "brown", name: "브라운", hex: "#f97316" },
    { id: "lime", name: "라임", hex: "#a3e635" },
  ],
  molokai: [
    { id: "red", name: "레드", hex: "#ff5c93" },
    { id: "orange", name: "오렌지", hex: "#ffb37a" },
    { id: "yellow", name: "옐로우", hex: "#fbe99b" },
    { id: "green", name: "그린", hex: "#b9f76a" },
    { id: "blue", name: "블루", hex: "#7ee0ff" },
    { id: "purple", name: "퍼플", hex: "#d4b3ff" },
    { id: "pink", name: "핑크", hex: "#ff9ad6" },
    { id: "teal", name: "틸", hex: "#34d5c3" },
    { id: "brown", name: "브라운", hex: "#e6a46c" },
    { id: "lime", name: "라임", hex: "#d4ffa3" },
  ],
  gruvbox: [
    { id: "red", name: "레드", hex: "#fb4934" },
    { id: "orange", name: "오렌지", hex: "#fe8019" },
    { id: "yellow", name: "옐로우", hex: "#fbd270" },
    { id: "green", name: "그린", hex: "#c0d95c" },
    { id: "blue", name: "블루", hex: "#88c0d0" },
    { id: "purple", name: "퍼플", hex: "#e29ac0" },
    { id: "pink", name: "핑크", hex: "#ffb4c8" },
    { id: "teal", name: "틸", hex: "#9ad29a" },
    { id: "brown", name: "브라운", hex: "#e0a458" },
    { id: "lime", name: "라임", hex: "#e6ff7a" },
  ],
  sonokai: [
    { id: "red", name: "레드", hex: "#ff5c5c" },
    { id: "orange", name: "오렌지", hex: "#ffb284" },
    { id: "yellow", name: "옐로우", hex: "#f7dd87" },
    { id: "green", name: "그린", hex: "#c0f08a" },
    { id: "blue", name: "블루", hex: "#9be2dd" },
    { id: "purple", name: "퍼플", hex: "#ebb4cf" },
    { id: "pink", name: "핑크", hex: "#ffc0e3" },
    { id: "teal", name: "틸", hex: "#5bc8d4" },
    { id: "brown", name: "브라운", hex: "#e1a46a" },
    { id: "lime", name: "라임", hex: "#d7ff9e" },
  ],
  onedark: [
    { id: "red", name: "레드", hex: "#f28b97" },
    { id: "orange", name: "오렌지", hex: "#e9a86b" },
    { id: "yellow", name: "옐로우", hex: "#f6d19b" },
    { id: "green", name: "그린", hex: "#a2d68b" },
    { id: "blue", name: "블루", hex: "#7ec3ff" },
    { id: "purple", name: "퍼플", hex: "#d6a7ff" },
    { id: "pink", name: "핑크", hex: "#ff9ed6" },
    { id: "teal", name: "틸", hex: "#6fd0da" },
    { id: "brown", name: "브라운", hex: "#f08f7f" },
    { id: "lime", name: "라임", hex: "#c6ff7a" },
  ],
};

function isDarkModeActive(): boolean {
  if (typeof window === "undefined") return false;
  const root = document.documentElement;
  if (root.classList.contains("dark")) return true;
  const saved = window.localStorage.getItem("gbti_theme");
  return saved === "dark";
}

export function getCurrentColorThemeId(): ColorThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  const saved = window.localStorage.getItem("gbti_color_theme") as ColorThemeId | null;
  if (saved && saved in EVENT_COLOR_PALETTES) return saved;
  return DEFAULT_THEME_ID;
}

export function getCurrentEventColorPalette(): EventColor[] {
  const id = getCurrentColorThemeId();
  const dark = isDarkModeActive();
  const source = dark ? EVENT_COLOR_PALETTES_DARK : EVENT_COLOR_PALETTES;
  return source[id] ?? source[DEFAULT_THEME_ID];
}

// DB에 저장된 color 문자열(색상 ID 또는 hex)을 현재 테마에 맞는 hex로 변환
export function resolveEventColor(color: string | null | undefined): string {
  if (!color) {
    return getCurrentEventColorPalette()[0]?.hex ?? "#FDC205";
  }

  // 이미 hex 형태이면 그대로 사용
  if (color.startsWith("#")) return color;

  const palette = getCurrentEventColorPalette();
  const found = palette.find((c) => c.id === (color as ColorId));
  if (found) return found.hex;

  // 모르는 값이면, 혹시 모를 CSS 색상 문자열로 그대로 사용
  return color;
}