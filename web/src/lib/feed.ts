/** Client-safe feed types and the pitch / race / entity lifecycle, mirroring MemeArena. */

export type EntityData = {
  id: `0x${string}`;
  slug: string; // x handle lowercased, or "culture"
  name: string;
  kind: "person" | "org" | "topic" | "culture";
  x?: string; // X handle, if the entity is an X account
  active: boolean;
  maxRaces: number;
  window: number;
  cooldown: number;
  cooldownUntil: number;
};

export type RaceData = {
  id: string;
  entity: `0x${string}`;
  starter: string;
  start: number;
  end: number; // shared deadline of every pitch in the race
  winner: string; // pitch id, "0" while unwon
  cancelled: boolean;
};

export type PitchData = {
  id: string;
  raceId: string;
  entity: `0x${string}`;
  raceWinner: string;
  raceCancelled: boolean;
  pitcher: string;
  name: string;
  symbol: string;
  image?: string;
  lore?: string;
  source?: string;
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
  entities: EntityData[];
  races: RaceData[];
  pitches: PitchData[];
  launches: number;
  config: { target: string; minBack: string; maxPerPerson: string; pitchFee: string };
};

export type Backer = { wallet: `0x${string}`; amount: string; verified: boolean };

export type Status = "live" | "launched" | "expired" | "vetoed" | "lost";

export function statusOf(p: PitchData, now: number): Status {
  if (p.token) return "launched";
  if (p.vetoed) return "vetoed";
  if (p.raceCancelled || p.raceWinner !== "0") return "lost";
  if (now >= p.expires) return "expired";
  return "live";
}

export const raceLive = (r: RaceData, now: number) => !r.cancelled && r.winner === "0" && now < r.end;

/** What a new pitch on this entity would do right now. */
export function entityState(e: EntityData, races: RaceData[], now: number) {
  const live = races.filter((r) => r.entity === e.id && raceLive(r, now)).sort((a, b) => a.end - b.end);
  const coolingFor = e.cooldownUntil > now ? e.cooldownUntil - now : 0;
  const canStart = e.active && coolingFor === 0 && live.length < e.maxRaces;
  return { live, coolingFor, canStart };
}

/** 0..1 share of the target raised. */
export const progress = (p: Pick<PitchData, "total" | "target">) => Math.min(1, Number(BigInt(p.total)) / Number(BigInt(p.target) || 1n));

export const remaining = (p: Pick<PitchData, "total" | "target">) => BigInt(p.target) - BigInt(p.total);

export const STATUS_LABEL: Record<Status, string> = {
  live: "Live",
  launched: "Born",
  expired: "Expired",
  vetoed: "Removed",
  lost: "Lost the race",
};

export const unofficial = (e: Pick<EntityData, "name" | "kind">) =>
  e.kind === "culture" ? "Fan memes. Not financial advice." : `Unofficial fan memes. Not affiliated with or endorsed by ${e.name}.`;
