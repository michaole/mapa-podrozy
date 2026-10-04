export const INVITE_KEY = "mapa.pendingInvite";
export const ACTIVE_SPACE_KEY = "mapa.activeSpace";

/** localStorage that never throws (private mode, blocked storage). */
export const storage = {
  get(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  },
  remove(key: string) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

/** Where sign-in should come back to, carrying a pending invite along. */
export function authRedirectUrl(): string {
  const base = location.origin + location.pathname;
  const code = storage.get(INVITE_KEY);
  return code ? `${base}?invite=${encodeURIComponent(code)}` : base;
}

/** Running as an app from the iPhone/Android home screen. */
export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
