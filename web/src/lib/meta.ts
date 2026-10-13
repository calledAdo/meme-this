/** Entity and pitch URIs are small JSON documents stored as data: URIs (or https links to the same JSON). */
export type EntityMeta = { name: string; kind?: "person" | "org" | "topic" | "culture"; x?: string };
export type PitchMeta = { image?: string; lore?: string; source?: string };

const PREFIX = "data:application/json,";

export const encodeMeta = (value: object) => PREFIX + encodeURIComponent(JSON.stringify(value));

export function decodeMeta<T extends object>(uri: string, fallback: T): T {
  try {
    if (uri.startsWith(PREFIX)) return { ...fallback, ...JSON.parse(decodeURIComponent(uri.slice(PREFIX.length))) };
  } catch {}
  return fallback;
}

/** Only allow https images in pitch cards; anything else is dropped. */
export const safeImage = (url?: string) => (url && /^https:\/\//.test(url) ? url : undefined);

/** Link shorteners hide where a link goes, so sources must be plain https links to the real page. */
const SHORTENERS = /^(bit\.ly|t\.co|tinyurl\.com|goo\.gl|ow\.ly|buff\.ly|is\.gd|cutt\.ly|rb\.gy|shorturl\.at)$/i;

export function safeSource(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || SHORTENERS.test(u.hostname)) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

/** Tweet id from an x.com / twitter.com status link, for embedding. */
export function tweetId(url?: string): string | undefined {
  const m = url?.match(/^https:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i);
  return m?.[1];
}

export const sourceHost = (url: string) => new URL(url).hostname.replace(/^(www|mobile)\./, "");

/**
 * Tickers and names that would pass as an entity's own official coin are refused before a wallet popup
 * (the guardian can still veto anything that slips through).
 */
const OFFICIAL = /^(OFFICIAL|ELON|ELONMUSK|MUSK|TRUMP|DONALDTRUMP|OPENAI|GOOGLE|APPLE|CZ|BINANCE|CIRCLE|USDC|ARC)$/;
export const looksOfficial = (symbol: string, name: string) => OFFICIAL.test(symbol) || /\bofficial\b/i.test(name);
