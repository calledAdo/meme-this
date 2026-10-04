/** Client-safe feed types and the pitch lifecycle, mirroring MemeArena.statusOf. */

export type PromptData = {
  id: string;
  title: string;
  kind: string;
  sources: string[];
  host: string;
  end: number; // no new pitches after this
  winner: string; // pitch id, "0" while unwon
  cancelled: boolean;
};

export type PitchData = {
  id: string;
  promptId: string; // "0" = freestyle
  promptTitle?: string;
  promptWinner: string;
  promptCancelled: boolean;
  pitcher: string;
  name: string;
  symbol: string;
  image?: string;
  lore?: string;
  created: number;
  expires: number;
  vetoed: boolean;
  total: string; // USDC raw (6dp)
  target: string;
  maxPerPerson: string;
  backers: number;
  verifiedBackers: number;
  token: string | null;
};

export type FeedData = {
  pitches: PitchData[];
  prompts: PromptData[];
  launches: number;
  config: { target: string; minBack: string; maxPerPerson: string; pitchFee: string; lifetime: number };
};

export type Backer = { wallet: `0x${string}`; amount: string; verified: boolean };

export type Status = "live" | "launched" | "expired" | "vetoed" | "lost";

export function statusOf(p: PitchData, now: number): Status {
  if (p.token) return "launched";
  if (p.vetoed) return "vetoed";
  if (p.promptId !== "0" && (p.promptCancelled || p.promptWinner !== "0")) return "lost";
  if (now >= p.expires) return "expired";
  return "live";
}

/** 0..1 share of the target raised. */
export const progress = (p: Pick<PitchData, "total" | "target">) => Math.min(1, Number(BigInt(p.total)) / Number(BigInt(p.target) || 1n));

export const remaining = (p: Pick<PitchData, "total" | "target">) => BigInt(p.target) - BigInt(p.total);

export const promptOpen = (pr: PromptData, now: number) => !pr.cancelled && pr.winner === "0" && now < pr.end;

export const STATUS_LABEL: Record<Status, string> = {
  live: "Live",
  launched: "Born",
  expired: "Expired",
  vetoed: "Removed",
  lost: "Lost the race",
};
