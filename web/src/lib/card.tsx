import "server-only";
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const cardSize = { width: 1200, height: 630 };

const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));
const fontsPromise = Promise.all([font("ArchivoBlack-Regular.ttf"), font("SpaceMono-Regular.ttf"), font("SpaceMono-Bold.ttf")]);

const C = { bg: "#0b0a0f", panel: "#16141d", line: "#2a2733", ink: "#f7f3ea", muted: "#8c8698", accent: "#ffd84d", up: "#3ee08f", down: "#ff5d5d", violet: "#8b5cf6" };

export type Status = { label: string; tone: "live" | "born" | "missed" | "neutral" };
export type Stat = { label: string; value: string; tone?: "up" | "down" | "accent" };

/** Fetch a remote image into a data URI so a dead link can't break the whole card. */
export async function inlineImage(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(png|jpe?g|gif|webp)/.test(type)) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4_000_000) return undefined;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

const toneColor = (t?: Stat["tone"]) => (t === "up" ? C.up : t === "down" ? C.down : t === "accent" ? C.accent : C.ink);
const statusColor = { live: C.up, born: C.accent, missed: C.down, neutral: C.muted } as const;

/**
 * Exchange-style share card: one hero number, a ticker you can read from across the feed, a few stats.
 * Satori rules: inline styles only, every multi-child div needs display:flex.
 */
export async function shareCard(opts: {
  eyebrow: string; // round name
  ticker: string; // "$QUACK" or a round title
  name?: string;
  image?: string; // data URI
  status: Status;
  hero?: { label: string; value: string; tone?: Stat["tone"] }; // the big PnL-style number
  stats: Stat[];
  personal?: string; // "I backed $5 · 1.20x early bonus"
}) {
  const [archivo, mono, monoBold] = await fontsPromise;
  const tickerSize = opts.ticker.length > 14 ? 56 : opts.ticker.length > 9 ? 72 : 92;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.bg, color: C.ink, fontFamily: "Mono", position: "relative", padding: "44px 56px" }}>
        {/* glows */}
        <div style={{ position: "absolute", top: -220, right: -160, width: 640, height: 640, borderRadius: 640, background: "radial-gradient(circle, rgba(255,216,77,0.35) 0%, rgba(255,216,77,0) 70%)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: -260, left: -200, width: 700, height: 700, borderRadius: 700, background: "radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(139,92,246,0) 70%)", display: "flex" }} />

        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", fontFamily: "Archivo", fontSize: 34, letterSpacing: -1 }}>
            MEME<span style={{ background: C.accent, color: C.bg, padding: "0 10px", marginLeft: 6, borderRadius: 6 }}>THIS</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, fontWeight: 700, color: statusColor[opts.status.tone], border: `2px solid ${statusColor[opts.status.tone]}`, borderRadius: 999, padding: "8px 22px" }}>
            <div style={{ width: 14, height: 14, borderRadius: 14, background: statusColor[opts.status.tone], display: "flex" }} />
            {opts.status.label}
          </div>
        </div>

        {/* body */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 44, marginTop: 8, marginBottom: 20 }}>
          <div style={{ display: "flex", width: 230, height: 230, borderRadius: 32, border: `4px solid ${C.accent}`, overflow: "hidden", alignItems: "center", justifyContent: "center", background: C.panel, boxShadow: "0 0 60px rgba(255,216,77,0.25)" }}>
            {opts.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={opts.image} width={230} height={230} style={{ objectFit: "cover" }} alt="" />
            ) : (
              <div style={{ display: "flex", fontFamily: "Archivo", fontSize: 64, color: C.accent }}>{opts.ticker.replace("$", "").slice(0, 3)}</div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 26, color: C.muted }}>{opts.eyebrow}</div>
            <div style={{ display: "flex", fontFamily: "Archivo", fontSize: tickerSize, lineHeight: 1, letterSpacing: -3, marginTop: 6 }}>{opts.ticker}</div>
            {opts.name && <div style={{ display: "flex", fontSize: 26, color: C.ink, marginTop: 6, opacity: 0.85 }}>{opts.name}</div>}
            {opts.hero && (
              <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
                <div style={{ display: "flex", fontSize: 20, color: C.muted, textTransform: "uppercase", letterSpacing: 2 }}>{opts.hero.label}</div>
                <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.05, color: toneColor(opts.hero.tone), letterSpacing: -2 }}>{opts.hero.value}</div>
              </div>
            )}
          </div>
        </div>

        {/* stats */}
        <div style={{ display: "flex", gap: 16 }}>
          {opts.stats.slice(0, 4).map((s) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", flex: 1, background: "rgba(22,20,29,0.85)", border: `2px solid ${C.line}`, borderRadius: 18, padding: "14px 20px" }}>
              <div style={{ display: "flex", fontSize: 18, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
              <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: toneColor(s.tone), marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, fontSize: 22, color: C.muted }}>
          <div style={{ display: "flex", color: opts.personal ? C.accent : C.muted, fontWeight: 700 }}>{opts.personal ?? "Back it with USDC. When it fills, it's born."}</div>
          <div style={{ display: "flex" }}>Live on Arc · USDC</div>
        </div>
      </div>
    ),
    {
      ...cardSize,
      fonts: [
        { name: "Archivo", data: archivo, weight: 400, style: "normal" },
        { name: "Mono", data: mono, weight: 400, style: "normal" },
        { name: "Mono", data: monoBold, weight: 700, style: "normal" },
      ],
    },
  );
}
