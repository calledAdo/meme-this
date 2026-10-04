import { SITE_URL } from "./chain";

/** Snapshot of what a share card shows; becomes query params on the shared link. */
export type CardParams = {
  sym: string;
  name?: string;
  round: string; // prompt title, or "Freestyle"
  total: number; // USDC
  backers?: number;
  rank?: number;
  of?: number;
  min: number; // target: USDC that makes the pitch launch
  end?: number; // unix seconds the pitch expires
  s?: "live" | "born" | "missed";
  img?: string;
  a?: number; // my amount (personal card)
  b?: number; // my early bonus multiplier
};

export const CARD_KEYS = ["sym", "name", "round", "total", "backers", "rank", "of", "min", "end", "s", "img", "a", "b"] as const;

export function cardQuery(p: CardParams) {
  const q = new URLSearchParams();
  for (const k of CARD_KEYS) {
    const v = p[k];
    if (v !== undefined && v !== "" && !(typeof v === "number" && !Number.isFinite(v))) q.set(k, String(typeof v === "number" ? +v.toFixed(2) : v));
  }
  return q.toString();
}

export const pitchShareUrl = (pitchId: string, p: CardParams) => `${SITE_URL}/p/${pitchId}?${cardQuery(p)}`;
