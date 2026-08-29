/**
 * Rasterlaag voor de OpenGraph-kaart.
 *
 * Discord, WhatsApp, Slack, iMessage en LinkedIn renderen geen SVG in een
 * deelkaart: ze verwachten PNG of JPEG. Daarom rasteriseren we dezelfde
 * vectorkaart met resvg (WebAssembly), wat overal werkt waar `fetch` bestaat —
 * dus ook in de edge-runtime. Zowel de wasm-binary als het font worden één
 * keer per isolate opgehaald en daarna hergebruikt.
 */

const WASM_URL = "https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
/** Eigen fonts uit `public/fonts` — geen externe fontdienst, geen tracking. */
const FONT_PATHS = ["/fonts/Inter-Regular.ttf", "/fonts/Inter-SemiBold.ttf"];

/**
 * De wasm-runtime kan per isolate maar één keer geïnitialiseerd worden, terwijl
 * dit module tijdens ontwikkeling wél opnieuw geladen wordt. De vlag leeft
 * daarom op `globalThis`.
 */
const globalScope = globalThis as typeof globalThis & {
  __routResvgReady?: Promise<void>;
};
let fontsReady: Promise<Uint8Array[]> | null = null;

async function ensureWasm() {
  if (!globalScope.__routResvgReady) {
    globalScope.__routResvgReady = (async () => {
      const { initWasm } = await import("@resvg/resvg-wasm");
      const response = await fetch(WASM_URL);
      if (!response.ok) throw new Error(`resvg wasm ${response.status}`);
      try {
        await initWasm(await response.arrayBuffer());
      } catch (error) {
        // Al geïnitialiseerd in dit isolate: dat is precies wat we wilden.
        if (!/already initialized/i.test(String(error))) throw error;
      }
    })().catch((error) => {
      globalScope.__routResvgReady = undefined;
      throw error;
    });
  }
  return globalScope.__routResvgReady;
}

async function ensureFonts(origin: string) {
  if (!fontsReady) {
    fontsReady = Promise.all(
      FONT_PATHS.map(async (path) => {
        const response = await fetch(new URL(path, origin).toString());
        if (!response.ok) throw new Error(`font ${path} ${response.status}`);
        return new Uint8Array(await response.arrayBuffer());
      }),
    ).catch((error) => {
      fontsReady = null;
      throw error;
    });
  }
  return fontsReady;
}

/**
 * Zet een SVG-string om in PNG-bytes. Gooit wanneer de wasm-runtime of de
 * fonts onbereikbaar zijn; de aanroeper valt dan terug op de SVG-variant.
 */
export async function svgToPng(
  svg: string,
  origin: string,
  width = 1200,
): Promise<Uint8Array> {
  await ensureWasm();
  const fonts = await ensureFonts(origin);
  const { Resvg } = await import("@resvg/resvg-wasm");
  const renderer = new Resvg(svg, {
    background: "#131211",
    fitTo: { mode: "width", value: width },
    font: {
      fontBuffers: fonts,
      defaultFontFamily: "Inter",
      loadSystemFonts: false,
    },
  });
  return renderer.render().asPng();
}

/**
 * Haalt een afbeelding op en geeft die terug als data-URI. resvg kan geen
 * netwerkverzoeken doen, dus avatars moeten ingebed worden voor we
 * rasteriseren. Bij twijfel (te groot, geen afbeelding, fout) geven we `null`
 * terug zodat de kaart terugvalt op de initialen.
 */
export async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/") || type.includes("svg")) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 3_000_000) return null;
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:${type};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}
