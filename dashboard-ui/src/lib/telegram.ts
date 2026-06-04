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

interface WebApp {
  initData: string;
  initDataUnsafe?: InitDataUnsafe;
  themeParams: ThemeParams;
  HapticFeedback?: Haptic;
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

export function ready() {
  const tg = getWebApp();
  try { tg?.ready(); } catch { /* tolerate */ }
  try { tg?.expand(); } catch { /* tolerate */ }
  applyTheme();
  try {
    tg?.onEvent?.("themeChanged", applyTheme);
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
