"use client";

import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge, LiveDot } from "@/components/ui/badge";
import { entityState, progress, statusOf, unofficial, type EntityData, type FeedData, type PitchData } from "@/lib/feed";
import { fmtLeft, fmtUsdc } from "@/lib/format";
import { pitchShareUrl } from "@/lib/share";
import { useNow } from "@/lib/useNow";
import { cn } from "@/lib/cn";
import { PitchDialog } from "./PitchDialog";
import { PitchRow } from "./PitchRow";
import { PitchSheet } from "./PitchSheet";
import { SidePanel } from "./SidePanel";
import { usePlayer } from "./usePlayer";

type Tab = "live" | "born" | "ended";

/**
 * The whole game on one screen. Memes are pitched about entities (people, organisations, Culture); the first
 * pitch on an idle entity starts a race, and the first pitch in a race to hit its target is born. With `entity`
 * set, the screen shows just that entity. Opening a pitch is a side sheet (?p=ID, so it can be shared).
 */
export function Feed({ feed, entity, initialPitch }: { feed: FeedData; entity?: EntityData; initialPitch?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const now = useNow();
  const [tab, setTab] = useState<Tab>("live");
  const [pitchFor, setPitchFor] = useState<string | null>(null); // entity id the pitch dialog is open for
  const openId = params.get("p") ?? initialPitch ?? null;

  const byId = useMemo(() => new Map(feed.entities.map((e) => [e.id, e])), [feed.entities]);
  const pitches = useMemo(() => (entity ? feed.pitches.filter((p) => p.entity === entity.id) : feed.pitches), [feed.pitches, entity]);
  const player = usePlayer(useMemo(() => feed.pitches.map((p) => p.id), [feed.pitches]));

  // Keep the feed fresh without a reload (server reads are cached for a few seconds).
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(t);
  }, [router]);

  const groups = useMemo(() => {
    const live: PitchData[] = [], born: PitchData[] = [], ended: PitchData[] = [];
    for (const p of pitches) {
      const s = statusOf(p, now);
      (s === "live" ? live : s === "launched" ? born : ended).push(p);
    }
    // Closest to being born first; ties go to the older pitch.
    live.sort((a, b) => progress(b) - progress(a) || Number(a.id) - Number(b.id));
    return { live, born, ended };
  }, [pitches, now]);

  const setOpen = (id: string | null) => {
    const q = new URLSearchParams(params.toString());
    if (id) q.set("p", id);
    else q.delete("p");
    router.replace(`${pathname}${q.size ? `?${q}` : ""}`, { scroll: false });
  };

  const share = (id: string) => {
    const p = feed.pitches.find((x) => x.id === id);
    if (!p) return;
    const s = statusOf(p, now);
    const my = player.mine.get(id);
    const e = byId.get(p.entity);
    const url = pitchShareUrl(id, {
      sym: p.symbol,
      name: p.name,
      round: e?.name ?? "Culture",
      total: Number(p.total) / 1e6,
      backers: p.backers,
      min: Number(p.target) / 1e6,
      end: p.expires,
      s: s === "launched" ? "born" : s === "live" ? "live" : "missed",
      img: p.image,
      a: my ? Number(my.amount) / 1e6 : undefined,
      b: my ? Number(my.weighted) / Number(my.amount) : undefined,
    });
    const left = fmtUsdc(BigInt(p.target) - BigInt(p.total));
    const about = e && e.kind !== "culture" ? ` in the ${e.name} race` : "";
    const text =
      s === "launched"
        ? `$${p.symbol} was born on Meme This. The crowd backed it into existence.`
        : my
          ? `I'm backing $${p.symbol}${about} on Meme This. ${left} more and it's born as a coin.`
          : `$${p.symbol} is ${left} away from being born${about} on Meme This. First to fill wins.`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank", "noopener");
  };

  const open = openId ? feed.pitches.find((p) => p.id === openId) ?? null : null;
  const list = groups[tab];
  const newPitch = () => setPitchFor(entity?.id ?? feed.entities.find((e) => entityState(e, feed.races, now).canStart || entityState(e, feed.races, now).live.length > 0)?.id ?? feed.entities[0]?.id ?? null);

  return (
    <div className="space-y-10">
      {entity ? <EntityHeader entity={entity} feed={feed} now={now} onPitch={() => setPitchFor(entity.id)} /> : <Hero feed={feed} live={groups.live.length} />}

      {!entity && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-black/60">Pick who the meme is about · one race at a time, first to fill wins</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {feed.entities.map((e) => (
              <EntityCard key={e.id} e={e} feed={feed} now={now} />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section className="space-y-3">
          <div className="flex gap-1 rounded-lg bg-black/[0.04] p-1 text-sm">
            {(["live", "born", "ended"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn("flex-1 rounded-md px-3 py-1.5 font-medium tracking-tight transition-colors", tab === t ? "bg-white shadow-sm" : "text-black/60 hover:text-black")}>
                {t === "live" ? "Live" : t === "born" ? "Born" : "Refunding"} <span className="font-mono text-xs text-black/40">{groups[t].length}</span>
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/20 px-6 py-16 text-center">
              <p className="text-lg font-semibold tracking-tighter">{tab === "live" ? "No live pitches" : tab === "born" ? "Nothing born yet" : "Nothing here"}</p>
              <p className="mt-1 max-w-xs text-sm text-black/60">
                {tab === "live" ? "Pitch the first meme. It's free, and your pitch starts the race." : tab === "born" ? "A pitch is born the second its backing hits the target." : "Pitches that expired, lost their race or were removed show up here, with refunds open."}
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-black/10 rounded-xl border border-black/10">
              {list.map((p) => (
                <PitchRow key={p.id} p={p} entity={entity ? undefined : byId.get(p.entity)} now={now} mine={player.mine.has(p.id)} onOpen={setOpen} />
              ))}
            </ol>
          )}
        </section>
        <SidePanel feed={feed} now={now} player={player} onOpen={setOpen} onNewPitch={newPitch} />
      </div>

      {open && <PitchSheet key={open.id} pitch={open} entity={byId.get(open.entity)} now={now} player={player} onClose={() => setOpen(null)} onShare={share} />}
      {pitchFor && (
        <PitchDialog feed={feed} entityId={pitchFor} lockEntity={!!entity} now={now} player={player} onClose={() => setPitchFor(null)} />
      )}
    </div>
  );
}

function Hero({ feed, live }: { feed: FeedData; live: number }) {
  return (
    <section className="space-y-6">
      <div className="space-y-4">
        <Badge tone="live"><LiveDot /> Live on Arc</Badge>
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tighter sm:text-6xl">
          Back a meme. <span className="text-black/40">At {fmtUsdc(feed.config.target)} it&apos;s born.</span>
        </h1>
        <p className="max-w-2xl text-black/60">
          Pitch a coin about Elon, OpenAI, Trump or pure culture, for free. Your pitch starts a race; others pitch rivals. The first to reach {fmtUsdc(feed.config.target)} of backing launches on Uniswap that instant, with every backer buying in at one price. Everyone else is refunded.
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-black/10 bg-black/10">
        {[
          ["Live pitches", String(live)],
          ["Coins born", String(feed.launches)],
          ["Born at", fmtUsdc(feed.config.target)],
        ].map(([k, v]) => (
          <div key={k} className="bg-white px-4 py-3">
            <dt className="text-xs text-black/60">{k}</dt>
            <dd className="mt-0.5 font-mono text-lg font-semibold tracking-tight">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function EntityTile({ e, size = 40 }: { e: Pick<EntityData, "name" | "kind">; size?: number }) {
  // Our own neutral tile, never the real person's photo or logo (that would imply endorsement).
  const initials = e.kind === "culture" ? "✦" : e.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-lg font-semibold tracking-tighter", e.kind === "culture" ? "bg-black text-white" : "bg-black/[0.06]")} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </div>
  );
}

function raceLine(e: EntityData, feed: FeedData, now: number) {
  const { live, coolingFor, canStart } = entityState(e, feed.races, now);
  if (live.length > 0) {
    const n = feed.pitches.filter((p) => live.some((r) => r.id === p.raceId)).length;
    return { tone: "live" as const, text: `${live.length > 1 ? `${live.length} races` : "Race live"} · ${n} ${n === 1 ? "pitch" : "pitches"} · ${fmtLeft(live[0].end - now)} left` };
  }
  if (coolingFor > 0) return { tone: "neutral" as const, text: `Just born · next race in ${fmtLeft(coolingFor)}` };
  return { tone: "neutral" as const, text: canStart ? "Open · your pitch starts the race" : "Paused" };
}

function EntityCard({ e, feed, now }: { e: EntityData; feed: FeedData; now: number }) {
  const line = raceLine(e, feed, now);
  return (
    <Link href={`/e/${e.slug}`} className="group flex items-center gap-3 rounded-xl border border-black/10 p-4 transition-colors duration-300 hover:bg-black/[0.02]">
      <EntityTile e={e} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold tracking-tighter">{e.name}</div>
        <div className={cn("truncate text-xs", line.tone === "live" ? "text-emerald-700" : "text-black/50")}>{line.text}</div>
      </div>
      <ArrowRight className="size-4 text-black/30 transition-transform duration-300 group-hover:translate-x-1" />
    </Link>
  );
}

function EntityHeader({ entity, feed, now, onPitch }: { entity: EntityData; feed: FeedData; now: number; onPitch: () => void }) {
  const { live, coolingFor, canStart } = entityState(entity, feed.races, now);
  const born = feed.pitches.filter((p) => p.entity === entity.id && p.token).length;
  return (
    <section className="space-y-5">
      <Link href="/" className="text-xs text-black/50 hover:text-black">← All entities</Link>
      <div className="flex items-center gap-4">
        <EntityTile e={entity} size={64} />
        <div>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tighter sm:text-5xl">{entity.name}</h1>
          {entity.x && (
            <a href={`https://x.com/${entity.x}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-black/60 hover:text-black">
              @{entity.x} <ArrowUpRight className="size-3.5" />
            </a>
          )}
        </div>
      </div>
      <p className="text-xs text-black/50">{unofficial(entity)}</p>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 p-4">
        {live.length > 0 ? (
          <Badge tone="live"><LiveDot /> {live.length > 1 ? `${live.length} races live` : "Race live"} · {fmtLeft(live[0].end - now)} left</Badge>
        ) : coolingFor > 0 ? (
          <Badge>Just born · next race in {fmtLeft(coolingFor)}</Badge>
        ) : (
          <Badge>No race yet · your pitch starts one</Badge>
        )}
        <span className="text-sm text-black/60">
          {Math.round(entity.window / 3600)}h races · first to fill is born{entity.cooldown > 0 ? ` · ${Math.round(entity.cooldown / 3600)}h break after a birth` : ""} · {born} born
        </span>
        <button onClick={onPitch} disabled={!canStart && live.length === 0} className="ml-auto rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40">
          {live.length > 0 ? "Pitch a rival" : "Start a race"}
        </button>
      </div>
    </section>
  );
}
