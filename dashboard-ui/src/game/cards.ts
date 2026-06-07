// Self-contained card presentation. SP1 renders cards as styled DOM — no
// dependency on the bot's Telegram sticker file_ids. The Spanish deck has four
// suits; we map each to a glyph + a color family for the card face.

import type { Suit } from "./types";

interface SuitMeta {
  glyph: string;
  /** Tailwind-free: a CSS custom-property name set per suit (see game.css). */
  cls: string;
  label: string;
}

const SUITS: Record<Suit, SuitMeta> = {
  Oro: { glyph: "🪙", cls: "suit-oro", label: "Oro" },
  Copa: { glyph: "🍷", cls: "suit-copa", label: "Copa" },
  Espada: { glyph: "⚔️", cls: "suit-espada", label: "Espada" },
  Basto: { glyph: "🌳", cls: "suit-basto", label: "Basto" },
};

export function suitMeta(type: Suit): SuitMeta {
  return SUITS[type] ?? { glyph: "?", cls: "", label: type };
}

/**
 * Base URL for the real Spanish-deck card images the bot serves at
 * `<dashboard-path>/cards/`. Derived from the page URL so it works under any
 * nginx prefix (same trick as the socket path). Files are `<value>-<type>.png`
 * (e.g. 7-Espada.png) plus back.png.
 */
export const CARDS_BASE: string = (() => {
  try {
    return window.location.pathname.replace(/[^/]*$/, "") + "cards/";
  } catch {
    return "cards/";
  }
})();

export function cardImgUrl(value: number, type: Suit): string {
  return `${CARDS_BASE}${value}-${type}.png`;
}

export const cardBackUrl: string = `${CARDS_BASE}back.png`;

/** Spanish-deck rank labels. Values jump 7 → 10/11/12 (sota/caballo/rey). */
export function rankLabel(value: number): string {
  switch (value) {
    case 1:
      return "A";
    case 10:
      return "S"; // Sota
    case 11:
      return "C"; // Caballo
    case 12:
      return "R"; // Rey
    default:
      return String(value);
  }
}

/** Full rank name for accessibility / titles. */
export function rankName(value: number): string {
  switch (value) {
    case 1:
      return "As";
    case 10:
      return "Sota";
    case 11:
      return "Caballo";
    case 12:
      return "Rey";
    default:
      return String(value);
  }
}

export function cardLabel(value: number, type: Suit): string {
  return `${rankName(value)} de ${suitMeta(type).label}`;
}
