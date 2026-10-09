// Keep the screen on while the WebApp is open — the referee's phone lies on
// the table showing the score. Telegram has no Mini App method for it (up to
// Bot API 10.1), so, best effort:
//  1. the standard Screen Wake Lock API, where the client allows it (Telegram
//     Web/Desktop, iOS WebKit). It's released whenever the app is hidden, so
//     it's re-requested on return.
//  2. otherwise (Android's WebView rejects it) a muted, silent clip playing
//     full-viewport at opacity 0: Chromium holds a video wake lock only while
//     ≥75 % of the video is on screen and it covers ≥20 % of the viewport, so
//     a hidden 1 px video (the classic NoSleep trick) no longer works. Muted,
//     so it never interrupts the user's music. Rewound by hand instead of
//     `loop` (WebKit ignores looping media for sleep).
// The choice is a preference (Mi cuenta → Preferencias), on by default.
import { useSyncExternalStore } from "react";
import clipUrl from "./keepawake.mp4?url";
import { getWebApp } from "./telegram";

/** off: not wanted / not armed yet · wakelock / video: holding the screen ·
 *  failed: neither works here (until the next tap retries). */
export type AwakeMode = "off" | "wakelock" | "video" | "failed";

interface Sentinel {
  release: () => Promise<void>;
  addEventListener: (type: "release", cb: () => void) => void;
}
type WakeLockApi = { request: (type: "screen") => Promise<Sentinel> };

const KEY = "caida.keepAwake";
let enabled = false;
let wired = false;
let mode: AwakeMode = "off";
let sentinel: Sentinel | null = null;
let video: HTMLVideoElement | null = null;
let arming: Promise<void> | null = null;
const subs = new Set<() => void>();

function setMode(next: AwakeMode) {
  if (mode === next) return;
  mode = next;
  document.documentElement.dataset.keepAwake = next;
  subs.forEach((cb) => cb());
}

export function keepAwakeWanted(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

function makeVideo(): HTMLVideoElement {
  const v = document.createElement("video");
  v.muted = true;
  v.defaultMuted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.setAttribute("muted", "");
  v.setAttribute("playsinline", "");
  v.setAttribute("webkit-playsinline", "");
  v.setAttribute("aria-hidden", "true");
  v.setAttribute("disablepictureinpicture", "");
  v.setAttribute("disableremoteplayback", "");
  v.tabIndex = -1;
  Object.assign(v.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    objectFit: "cover",
    opacity: "0",
    pointerEvents: "none",
    zIndex: "-1",
  });
  v.src = clipUrl;
  // never reach the end (an ended video releases its wake lock)
  v.addEventListener("timeupdate", () => {
    if (v.currentTime > 0.5) v.currentTime = Math.random() * 0.5;
  });
  document.body.appendChild(v);
  return v;
}

async function tryWakeLock(): Promise<boolean> {
  const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
  if (!api) return false;
  try {
    const s = await api.request("screen");
    if (!enabled) {
      s.release().catch(() => {});
      return true;
    }
    sentinel = s;
    s.addEventListener("release", () => {
      sentinel = null;
      // hidden app → released; arm() asks again when it's back
      if (mode === "wakelock") setMode("off");
    });
    return true;
  } catch {
    return false; // e.g. Android WebView: "disallowed by permissions policy"
  }
}

async function tryVideo(): Promise<boolean> {
  video ??= makeVideo();
  try {
    await video.play();
    return true;
  } catch {
    return false; // some WebViews only play after a tap: retried on the next one
  }
}

async function arm(): Promise<void> {
  if (!enabled || document.visibilityState !== "visible") return;
  if (sentinel || (video && !video.paused)) return;
  if (await tryWakeLock()) {
    if (!enabled) return;
    if (video && !video.paused) video.pause();
    setMode("wakelock");
    return;
  }
  setMode((await tryVideo()) && enabled ? "video" : untouched() ? "off" : "failed");
}

/** No tap yet: a refused play() may just be waiting for the first gesture. */
function untouched(): boolean {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation;
  return ua ? !ua.hasBeenActive : false;
}

function rearm() {
  if (arming) return;
  arming = arm().finally(() => {
    arming = null;
  });
}

function wire() {
  if (wired) return;
  wired = true;
  document.addEventListener("visibilitychange", rearm);
  // a tap is the user gesture some clients need to start playback
  document.addEventListener("pointerdown", rearm, { capture: true, passive: true });
  try {
    getWebApp()?.onEvent?.("activated", rearm); // Bot API 8.0: back from minimized
  } catch {
    // older client: visibilitychange covers it
  }
}

function start() {
  enabled = true;
  wire();
  rearm();
}

function stop() {
  enabled = false;
  sentinel?.release().catch(() => {});
  sentinel = null;
  if (video) {
    video.pause();
    video.remove();
    video = null;
  }
  setMode("off");
}

/** Call once at boot: keeps the screen on if the user wants it (default). */
export function initKeepAwake() {
  if (keepAwakeWanted()) start();
}

export function setKeepAwake(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // not persisted (private mode): still applies to this session
  }
  if (on) start();
  else stop();
}

function subscribe(cb: () => void) {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

/** Current mode, for the preference's status line. */
export function useKeepAwakeMode(): AwakeMode {
  return useSyncExternalStore(subscribe, () => mode);
}
