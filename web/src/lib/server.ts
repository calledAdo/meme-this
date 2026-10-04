import "server-only";
import { cache } from "react";
import { createPublicClient, http, zeroAddress } from "viem";
import { memeArenaAbi } from "./abi";
import { ARENA, arc } from "./chain";
import { decodeMeta, safeImage, type PitchMeta, type PromptMeta } from "./meta";
import type { Backer, FeedData, PitchData, PromptData } from "./feed";

// The public Arc RPC drops occasional requests; batch calls and retry with backoff.
export const arcClient = createPublicClient({
  chain: arc,
  batch: { multicall: true },
  transport: http(process.env.ARC_RPC_URL, { batch: true, retryCount: 4, retryDelay: 250, timeout: 10_000 }),
});

/**
 * Tiny in-memory TTL cache. Many visitors (and link-preview bots) load the same feed within seconds;
 * the public Arc RPC rate-limits, so reuse a result for a few seconds. In-flight calls are shared too.
 */
function ttl<A extends unknown[], R>(ms: number, fn: (...a: A) => Promise<R>) {
  const hits = new Map<string, { at: number; value: Promise<R> }>();
  return (...args: A): Promise<R> => {
    const key = JSON.stringify(args, (_, v) => (typeof v === "bigint" ? v.toString() : v));
    const hit = hits.get(key);
    if (hit && Date.now() - hit.at < ms) return hit.value;
    const value = fn(...args);
    hits.set(key, { at: Date.now(), value });
    value.catch(() => hits.delete(key));
    return value;
  };
}

const read = <F extends "pitchCount" | "promptCount" | "launchCount" | "config">(functionName: F) =>
  arcClient.readContract({ address: ARENA, abi: memeArenaAbi, functionName });

const readPitch = (id: bigint) => arcClient.readContract({ address: ARENA, abi: memeArenaAbi, functionName: "getPitch", args: [id] });
const readPrompt = (id: bigint) => arcClient.readContract({ address: ARENA, abi: memeArenaAbi, functionName: "getPrompt", args: [id] });

async function promptMeta(uri: string): Promise<PromptMeta> {
  if (uri.startsWith("https://")) {
    try {
      return await (await fetch(uri, { next: { revalidate: 3600 } })).json();
    } catch {}
  }
  return decodeMeta<PromptMeta>(uri, { title: "Untitled prompt" });
}

async function toPrompt(id: bigint, pr: Awaited<ReturnType<typeof readPrompt>>): Promise<PromptData> {
  const meta = await promptMeta(pr.uri);
  return {
    id: id.toString(),
    title: meta.title,
    kind: meta.kind ?? "news",
    sources: (meta.sources ?? []).filter((s) => s.startsWith("https://")),
    host: pr.host,
    end: Number(pr.end),
    winner: pr.winner.toString(),
    cancelled: pr.cancelled,
  };
}

function toPitch(id: bigint, p: Awaited<ReturnType<typeof readPitch>>, prompt?: PromptData): PitchData {
  const pm = decodeMeta<PitchMeta>(p.uri, {});
  return {
    id: id.toString(),
    promptId: p.promptId.toString(),
    promptTitle: prompt?.title,
    promptWinner: prompt?.winner ?? "0",
    promptCancelled: prompt?.cancelled ?? false,
    pitcher: p.pitcher,
    name: p.name,
    symbol: p.symbol,
    image: safeImage(pm.image),
    lore: pm.lore,
    created: Number(p.created),
    expires: Number(p.expires),
    vetoed: p.vetoed,
    total: p.total.toString(),
    target: p.target.toString(),
    maxPerPerson: p.maxPerPerson.toString(),
    backers: p.backers,
    verifiedBackers: p.verifiedBackers,
    token: p.token === zeroAddress ? null : p.token,
  };
}

const FEED_PITCHES = 80;
const FEED_PROMPTS = 20;

export const loadFeed = cache(ttl(4000, loadFeedUncached));

/** The newest pitches and prompts, newest first. Status is derived on the client so countdowns stay live. */
async function loadFeedUncached(): Promise<FeedData> {
  const [pitchCount, promptCount, launchCount, cfg] = await Promise.all([read("pitchCount"), read("promptCount"), read("launchCount"), read("config")]);
  const promptIds: bigint[] = [];
  for (let i = promptCount; i > 0n && promptIds.length < FEED_PROMPTS; i--) promptIds.push(i);
  const pitchIds: bigint[] = [];
  for (let i = pitchCount; i > 0n && pitchIds.length < FEED_PITCHES; i--) pitchIds.push(i);

  const [rawPrompts, rawPitches] = await Promise.all([Promise.all(promptIds.map(readPrompt)), Promise.all(pitchIds.map(readPitch))]);
  const prompts = await Promise.all(promptIds.map((id, i) => toPrompt(id, rawPrompts[i])));
  const byId = new Map(prompts.map((p) => [p.id, p]));

  // Pitches can answer prompts older than the newest few; fetch those too.
  const missing = [...new Set(rawPitches.map((p) => p.promptId).filter((id) => id !== 0n && !byId.has(id.toString())))];
  for (const pr of await Promise.all(missing.map(async (id) => toPrompt(id, await readPrompt(id))))) byId.set(pr.id, pr);

  return {
    pitches: pitchIds.map((id, i) => toPitch(id, rawPitches[i], byId.get(rawPitches[i].promptId.toString()))),
    prompts,
    launches: Number(launchCount),
    config: { target: cfg[0].toString(), minBack: cfg[1].toString(), maxPerPerson: cfg[2].toString(), pitchFee: cfg[3].toString(), lifetime: Number(cfg[4]) },
  };
}

/** One pitch, for shared links to pitches older than the feed window. */
export const loadPitch = cache(async (idStr: string): Promise<PitchData | null> => {
  if (!/^\d+$/.test(idStr) || idStr === "0") return null;
  const id = BigInt(idStr);
  const p = await readPitch(id);
  if (p.pitcher === zeroAddress) return null;
  const prompt = p.promptId === 0n ? undefined : await toPrompt(p.promptId, await readPrompt(p.promptId));
  return toPitch(id, p, prompt);
});

// ---------------------------------------------------------------- backer lists

/** First block to scan for events (the arena's deploy block); keeps log queries small. */
const FROM_BLOCK = BigInt(process.env.ARENA_FROM_BLOCK ?? "0");
const MAX_RANGE = 100_000n; // Arc RPC limit for eth_getLogs

const blockAtCache = new Map<bigint, bigint>();

/** First block whose timestamp is >= ts, by binary search. Cached once final (ts in the past). */
async function firstBlockAtOrAfter(ts: bigint, lo: bigint, hi: bigint) {
  const hit = blockAtCache.get(ts);
  if (hit !== undefined) return hit;
  const top = hi;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const block = await arcClient.getBlock({ blockNumber: mid });
    if (block.timestamp < ts) lo = mid + 1n;
    else hi = mid;
  }
  if (lo < top) blockAtCache.set(ts, lo); // the head is not final: a later block may still be first
  return lo;
}

export const backersOf = ttl(8000, backersOfUncached);

/**
 * Who backs a pitch, rebuilt by replaying its Backed / Withdrawn events. Backing is only possible between the
 * pitch's creation and its expiry (or launch), so only that block window is scanned.
 */
async function backersOfUncached(pitchId: bigint): Promise<Backer[]> {
  const p = await readPitch(pitchId);
  if (p.pitcher === zeroAddress) return [];
  const head = await arcClient.getBlock({ blockTag: "latest" });
  const from = await firstBlockAtOrAfter(p.created, FROM_BLOCK, head.number);
  const to = p.expires >= head.timestamp ? head.number : await firstBlockAtOrAfter(p.expires + 1n, from, head.number);

  const ranges: [bigint, bigint][] = [];
  for (let b = from; b <= to; b += MAX_RANGE) ranges.push([b, b + MAX_RANGE - 1n > to ? to : b + MAX_RANGE - 1n]);
  const fetchAll = (eventName: "Backed" | "Withdrawn") =>
    Promise.all(
      ranges.map(([fromBlock, toBlock]) =>
        arcClient.getContractEvents({ address: ARENA, abi: memeArenaAbi, eventName, args: { pitchId }, fromBlock, toBlock }),
      ),
    ).then((r) => r.flat());
  const [backed, withdrawn] = await Promise.all([fetchAll("Backed"), fetchAll("Withdrawn")]);
  const events = [...backed, ...withdrawn].sort((a, b) =>
    a.blockNumber === b.blockNumber ? (a.logIndex ?? 0) - (b.logIndex ?? 0) : a.blockNumber! < b.blockNumber! ? -1 : 1,
  );

  const state = new Map<string, Backer>();
  for (const e of events) {
    const a = e.args as { wallet: `0x${string}`; amount: bigint; verified?: boolean };
    const key = a.wallet.toLowerCase();
    const cur = state.get(key);
    if (e.eventName === "Backed") {
      state.set(key, { wallet: a.wallet, amount: ((cur ? BigInt(cur.amount) : 0n) + a.amount).toString(), verified: !!a.verified || !!cur?.verified });
    } else if (cur) {
      state.delete(key);
    }
  }
  return [...state.values()].sort((x, y) => (BigInt(y.amount) > BigInt(x.amount) ? 1 : BigInt(y.amount) < BigInt(x.amount) ? -1 : 0));
}

/** A prompt and every pitch in it (the feed only holds the newest pitches). */
export const loadPrompt = cache(async (idStr: string): Promise<{ prompt: PromptData; pitches: PitchData[] } | null> => {
  if (!/^\d+$/.test(idStr) || idStr === "0") return null;
  const id = BigInt(idStr);
  const raw = await readPrompt(id);
  if (raw.host === zeroAddress) return null;
  const [prompt, ids] = await Promise.all([
    toPrompt(id, raw),
    arcClient.readContract({ address: ARENA, abi: memeArenaAbi, functionName: "getPromptPitches", args: [id] }),
  ]);
  const pitches = await Promise.all(ids.map(async (pid) => toPitch(pid, await readPitch(pid), prompt)));
  return { prompt, pitches };
});

/** The feed plus extra pitches (e.g. an old shared one), newest first, without duplicates. */
export function withPitches(feed: FeedData, extra: PitchData[]): FeedData {
  const seen = new Set(feed.pitches.map((p) => p.id));
  const pitches = [...feed.pitches, ...extra.filter((p) => !seen.has(p.id))].sort((a, b) => Number(b.id) - Number(a.id));
  return { ...feed, pitches };
}
