import React, { useContext } from "react";
import { COLORS } from "./theme";

/**
 * The neutral colours a card draws its text, chips and surfaces with. The
 * diagram slide and the shared primitives read them from here, so the same
 * drawing works on the dark default and on a look's light paper or colour
 * field (src/looks/). Accent colours stay in theme.ts.
 */
export interface Ink {
  text: string;
  textSub: string;
  textMuted: string;
  surface: string;
  pill: string;
  hairline: string;
  bg: string;
}

export const DARK_INK: Ink = {
  text: COLORS.text,
  textSub: COLORS.textSub,
  textMuted: COLORS.textMuted,
  surface: COLORS.surface,
  pill: COLORS.pill,
  hairline: COLORS.hairline,
  bg: COLORS.bg,
};

export const InkContext = React.createContext<Ink>(DARK_INK);
export const useInk = () => useContext(InkContext);
