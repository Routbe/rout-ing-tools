import { useEffect, useRef, useState } from "react";

/**
 * Onzichtbare Cloudflare Turnstile-widget.
 *
 * Rendert niets zichtbaar (managed/invisible mode) en geeft het token door via
 * `onToken`. Zonder `VITE_TURNSTILE_SITE_KEY` doet de component niets, zodat de
 * app ook zonder configuratie blijft werken.
 */
interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      appearance?: "always" | "execute" | "interaction-only";
      size?: "normal" | "flexible" | "invisible";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "") as string;

/** True wanneer botbescherming daadwerkelijk actief is in de browser. */
export const turnstileConfigured = () => TURNSTILE_SITE_KEY.length > 0;

function loadScript(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src^="${SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve) => existing.addEventListener("load", () => resolve(), { once: true }));
  }
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `${SCRIPT_SRC}?render=explicit`;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => resolve(), { once: true });
    document.head.appendChild(script);
  });
}

export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const holder = useRef<HTMLDivElement | null>(null);
  const widget = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!turnstileConfigured()) return;
    let cancelled = false;
    void loadScript().then(() => {
      if (cancelled) return;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !holder.current || widget.current || !window.turnstile) return;
    widget.current = window.turnstile.render(holder.current, {
      sitekey: TURNSTILE_SITE_KEY,
      appearance: "interaction-only",
      size: "flexible",
      callback: (token) => onToken(token),
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
    });
    const id = widget.current;
    return () => {
      try {
        if (id) window.turnstile?.remove(id);
      } catch {
        /* widget al opgeruimd */
      }
      widget.current = null;
    };
    // onToken is stabiel genoeg: de widget hoeft niet opnieuw te renderen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!turnstileConfigured()) return null;
  return <div ref={holder} className="mt-2" aria-hidden />;
}
