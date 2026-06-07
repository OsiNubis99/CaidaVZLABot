// Thin typed wrapper around window.Telegram.WebApp.
// Exposes only what the app actually uses; failures are tolerated
// because some clients (or out-of-Telegram opens) won't have the SDK.

interface ThemeParams {
  bg_color?: string;
  secondary_bg_color?: string;
  text_color?: string;
  hint_color?: string;
  button_color?: string;
  button_text_color?: string;
  link_color?: string;
}

interface Haptic {
  notificationOccurred?: (type: "error" | "success" | "warning") => void;
  impactOccurred?: (style: "light" | "medium" | "heavy") => void;
}

interface InitDataUnsafe {
  start_param?: string;
  user?: { id: number; first_name?: string; last_name?: string; username?: string };
}

interface SafeAreaInset {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

interface WebApp {
  initData: string;
  initDataUnsafe?: InitDataUnsafe;
  themeParams: ThemeParams;
  HapticFeedback?: Haptic;
  // Fullscreen + safe areas (Bot API 8.0+). Absent on older clients.
  isFullscreen?: boolean;
  safeAreaInset?: SafeAreaInset;
  contentSafeAreaInset?: SafeAreaInset;
  requestFullscreen?: () => void;
  // Stop Telegram from reading a vertical swipe as "minimize/close" so inner
  // content can scroll (Bot API 7.7+).
  disableVerticalSwipes?: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  ready: () => void;
  expand: () => void;
  openTelegramLink: (url: string) => void;
  onEvent: (event: string, handler: () => void) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp };
  }
}

export function getWebApp(): WebApp | null {
  return (window.Telegram && window.Telegram.WebApp) || null;
}

export function initData(): string {
  const tg = getWebApp();
  return tg?.initData || "";
}

/** The `startapp` deep-link parameter, if the WebApp was opened via
 *  `t.me/<bot>/app?startapp=<code>`. Empty string when absent. */
export function startParam(): string {
  const tg = getWebApp();
  return tg?.initDataUnsafe?.start_param || "";
}

export function applyTheme() {
  const tg = getWebApp();
  if (!tg) return;
  const p = tg.themeParams || {};
  const root = document.documentElement;
  const set = (k: string, v?: string) => v && root.style.setProperty(k, v);
  set("--bg", p.bg_color);
  set("--bg-card", p.secondary_bg_color);
  set("--text", p.text_color);
  set("--text-muted", p.hint_color);
  set("--accent", p.button_color);
  set("--accent-text", p.button_text_color);
  set("--link", p.link_color);
}

/** Push Telegram's safe-area + content-safe-area insets into CSS vars so the
 *  layout can clear the notch and Telegram's floating controls in fullscreen.
 *  The content inset is measured from the device safe area, so the usable top
 *  offset is the sum of both. Falls back to 0 on clients without the API. */
export function applyInsets() {
  const tg = getWebApp();
  const root = document.documentElement;
  const safe = tg?.safeAreaInset || {};
  const content = tg?.contentSafeAreaInset || {};
  const top = (safe.top || 0) + (content.top || 0);
  const bottom = (safe.bottom || 0) + (content.bottom || 0);
  root.style.setProperty("--tg-top-inset", `${top}px`);
  root.style.setProperty("--tg-bottom-inset", `${bottom}px`);
}

export function ready() {
  const tg = getWebApp();
  try { tg?.ready(); } catch { /* tolerate */ }
  try { tg?.expand(); } catch { /* tolerate */ }
  applyTheme();
  applyInsets();
  // Open immersive ("like an app"). No-op on clients that don't support it
  // (fullscreenFailed on desktop/older); insets keep the layout correct
  // whether or not it actually goes fullscreen.
  try {
    if (typeof tg?.requestFullscreen === "function") tg.requestFullscreen();
  } catch { /* tolerate */ }
  // Let inner content scroll without Telegram hijacking the swipe to minimize.
  try {
    if (typeof tg?.disableVerticalSwipes === "function") tg.disableVerticalSwipes();
  } catch { /* tolerate */ }
  try {
    tg?.onEvent?.("themeChanged", applyTheme);
    tg?.onEvent?.("safeAreaChanged", applyInsets);
    tg?.onEvent?.("contentSafeAreaChanged", applyInsets);
    tg?.onEvent?.("fullscreenChanged", applyInsets);
    tg?.onEvent?.("viewportChanged", applyInsets);
  } catch { /* tolerate */ }
}

export function haptic(kind: "ok" | "err") {
  const tg = getWebApp();
  try {
    if (kind === "err") tg?.HapticFeedback?.notificationOccurred?.("error");
    else tg?.HapticFeedback?.notificationOccurred?.("success");
  } catch { /* tolerate */ }
}

export function openTelegramLink(url: string) {
  const tg = getWebApp();
  if (tg) tg.openTelegramLink(url);
  else window.open(url, "_blank");
}
