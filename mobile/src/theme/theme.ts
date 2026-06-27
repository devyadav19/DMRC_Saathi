// Design tokens for the DMRC Assistant.
// Palette is deliberately restrained: one institutional brand blue, neutral
// grays for structure, and the metro line colors used only as functional
// badges (never as decoration). No gradients, no mascots, minimal emoji.

export type ThemeMode = "light" | "dark";

export interface Theme {
  mode: ThemeMode;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textInverse: string;
  brand: string;
  brandAlt: string;
  bubbleUser: string;
  bubbleUserText: string;
  bubbleBot: string;
  bubbleBotText: string;
  success: string;
  warning: string;
  danger: string;
  chip: string;
  chipText: string;
  emergency: string;
  emergencyBg: string;
  info: string;
  infoBg: string;
  menuBg: string;
  menuItem: string;
  menuItemText: string;
  menuItemIcon: string;
}

export const lightTheme: Theme = {
  mode: "light",
  bg: "#F5F6F8",
  surface: "#FFFFFF",
  surfaceAlt: "#EEF1F5",
  border: "#E1E4EA",
  textPrimary: "#16191F",
  textSecondary: "#5B6370",
  textInverse: "#FFFFFF",
  brand: "#0B3B70",
  brandAlt: "#0F4C8C",
  bubbleUser: "#0B3B70",
  bubbleUserText: "#FFFFFF",
  bubbleBot: "#FFFFFF",
  bubbleBotText: "#16191F",
  success: "#1B8A5A",
  warning: "#B7791F",
  danger: "#C0392B",
  chip: "#EAF0F8",
  chipText: "#0B3B70",
  emergency: "#DC2626",
  emergencyBg: "#FEF2F2",
  info: "#2563EB",
  infoBg: "#EFF6FF",
  menuBg: "#FFFFFF",
  menuItem: "#F0F4FA",
  menuItemText: "#16191F",
  menuItemIcon: "#0B3B70",
};

export const darkTheme: Theme = {
  mode: "dark",
  bg: "#0D1117",
  surface: "#161B22",
  surfaceAlt: "#1C2330",
  border: "#262E3A",
  textPrimary: "#E7EAF0",
  textSecondary: "#9AA4B2",
  textInverse: "#0D1117",
  brand: "#3D8BFF",
  brandAlt: "#5B9DFF",
  bubbleUser: "#1F5DB0",
  bubbleUserText: "#FFFFFF",
  bubbleBot: "#1C2330",
  bubbleBotText: "#E7EAF0",
  success: "#37B978",
  warning: "#D9A441",
  danger: "#E0584A",
  chip: "#1C2330",
  chipText: "#5B9DFF",
  emergency: "#EF4444",
  emergencyBg: "#1C1517",
  info: "#60A5FA",
  infoBg: "#111827",
  menuBg: "#161B22",
  menuItem: "#1C2330",
  menuItemText: "#E7EAF0",
  menuItemIcon: "#5B9DFF",
};

// Functional line colors - used only as small badges next to a line name,
// matched to DMRC's public signage colors.
export const LINE_COLORS: Record<string, string> = {
  RED: "#E2231A",
  YELLOW: "#FBC02D",
  BLUE: "#0072BC",
  GREEN: "#00A651",
  VIOLET: "#7B2D8E",
  PINK: "#EC008C",
  MAGENTA: "#9C1F5C",
  "ORANGE/AIRPORT": "#F7941E",
  AQUA: "#00AEEF",
  GRAY: "#8A8D8F",
  RAPID: "#7AC143",
};

export function lineColor(line?: string | null): string {
  if (!line) return "#8A8D8F";
  return LINE_COLORS[line.toUpperCase()] ?? "#8A8D8F";
}

export function lineLabel(line?: string | null): string {
  if (!line) return "";
  const l = line.toUpperCase();
  if (l === "ORANGE/AIRPORT") return "Airport Express";
  return l.charAt(0) + l.slice(1).toLowerCase() + " Line";
}
