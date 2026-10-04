import "server-only";
import { inlineImage, shareCard, type Stat, type Status } from "./card";
import { safeImage } from "./meta";

/**
 * Share cards are drawn only from URL parameters the app put in the share link, so rendering a card
 * never touches the chain. The numbers are a snapshot taken when the link was shared.
 */
const str = (q: URLSearchParams, k: string, max = 40) => (q.get(k) ?? "").slice(0, max);
const num = (q: URLSearchParams, k: string) => {
  const n = Number(q.get(k));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function statusFrom(q: URLSearchParams): Status {
  const s = q.get("s");
  if (s === "born") return { label: "BORN", tone: "born" };
  if (s === "missed") return { label: "REFUNDED", tone: "missed" };
  const end = num(q, "end");
  const left = end - Math.floor(Date.now() / 1000);
  if (!end || left <= 0) return { label: "TIME UP", tone: "neutral" };
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
  return { label: h ? `${h}H ${m}M LEFT` : `${Math.max(m, 1)}M LEFT`, tone: "live" };
}

export async function pitchCardFromQuery(q: URLSearchParams) {
  const symbol = str(q, "sym", 10).toUpperCase().replace(/[^A-Z0-9]/g, "") || "MEME";
  const mine = num(q, "a");
  const bonus = num(q, "b");
  const target = num(q, "min");
  const pct = target ? Math.min(100, Math.round((num(q, "total") / target) * 100)) : 0;

  const stats: Stat[] = [
    ...(mine ? [{ label: "Total backed", value: usd(num(q, "total")) }] : []),
    { label: "Backers", value: q.has("backers") ? String(Math.floor(num(q, "backers"))) : "—" },
    { label: "Filled", value: `${pct}%`, tone: pct >= 80 ? "up" : undefined },
    { label: "Born at", value: usd(target) },
  ];

  return shareCard({
    eyebrow: !q.get("round") || q.get("round") === "Freestyle" ? "Freestyle pitch" : `Meme this: ${str(q, "round", 60)}`,
    ticker: `$${symbol}`,
    name: str(q, "name", 32) || undefined,
    image: await inlineImage(safeImage(q.get("img") ?? undefined)),
    status: statusFrom(q),
    hero: mine
      ? { label: bonus > 1.005 ? `I backed · ${bonus.toFixed(2)}x early bonus` : "I backed", value: usd(mine), tone: "accent" }
      : { label: q.get("s") === "born" ? "raised at launch" : "backed so far", value: usd(num(q, "total")), tone: "accent" },
    stats,
    personal: mine ? `I backed $${symbol}. When it fills, it's born.` : undefined,
  });
}
