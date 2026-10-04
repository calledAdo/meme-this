"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge, LiveDot } from "@/components/ui/badge";
import { progress, promptOpen, statusOf, type FeedData, type PitchData, type PromptData } from "@/lib/feed";
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
 * The whole game on one screen: live pitches racing to their target, and the player's own corner.
 * No rounds: a pitch is born the moment its backing hits the target. Opening a pitch is a side sheet
 * (?p=ID in the URL, so it can be shared) instead of a new page.
 */
export function Feed({ feed, prompt, initialPitch }: { feed: FeedData; prompt?: PromptData; initialPitch?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const now = useNow();
  const [tab, setTab] = useState<Tab>(prompt && prompt.winner !== "0" ? "born" : "live");
  const [pitchOpen, setPitchOpen] = useState(false);
  const openId = params.get("p") ?? initialPitch ?? null;

  const pitches = useMemo(() => (prompt ? feed.pitches.filter((p) => p.promptId === prompt.id) : feed.pitches), [feed.pitches, prompt]);
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

  const openPrompts = feed.prompts.filter((p) => promptOpen(p, now));

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
    const url = pitchShareUrl(id, {
      sym: p.symbol,
      name: p.name,
      round: p.promptTitle ?? "Freestyle",
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
    const text =
      s === "launched"
        ? `$${p.symbol} was born on Meme This. The crowd backed it into existence.`
        : my
          ? `I'm backing $${p.symbol} on Meme This. ${left} more and it's born as a coin.`
          : `$${p.symbol} is ${left} away from being born on Meme This. Back it before it expires.`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank", "noopener");
  };

  const open = openId ? feed.pitches.find((p) => p.id === openId) ?? null : null;
  const list = groups[tab];

  return (
    <div className="space-y-10">
      {prompt ? <PromptHeader prompt={prompt} now={now} pitches={pitches} /> : <Hero feed={feed} live={groups.live.length} />}

      {!prompt && openPrompts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-black/60">Prompts · first pitch to launch wins</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {openPrompts.map((pr) => {
              const entries = feed.pitches.filter((p) => p.promptId === pr.id);
              const lead = entries.filter((p) => statusOf(p, now) === "live").sort((a, b) => progress(b) - progress(a))[0];
              return (
                <Link key={pr.id} href={`/prompt/${pr.id}`} className="group rounded-xl border border-black/10 p-4 transition-colors duration-300 hover:bg-black/[0.02]">
                  <div className="flex items-center justify-between gap-2 text-xs text-black/50">
                    <span className="uppercase tracking-wider">{pr.kind}</span>
                    <span>{fmtLeft(pr.end - now)} left to pitch</span>
                  </div>
                  <div className="mt-1 font-semibold tracking-tighter">{pr.title}</div>
                  <div className="mt-2 flex items-center justify-between text-sm text-black/60">
                    <span>{entries.length} {entries.length === 1 ? "pitch" : "pitches"}{lead && ` · $${lead.symbol} leads at ${Math.round(progress(lead) * 100)}%`}</span>
                    <ArrowRight className="size-4 text-black/30 transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
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
                {tab === "live" ? "Pitch the first meme. It's free, and it goes live instantly." : tab === "born" ? "A pitch is born the second its backing hits the target." : "Pitches that expired, lost their prompt or were removed show up here, with refunds open."}
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-black/10 rounded-xl border border-black/10">
              {list.map((p) => (
                <PitchRow key={p.id} p={p} now={now} mine={player.mine.has(p.id)} showPrompt={!prompt} onOpen={setOpen} />
              ))}
            </ol>
          )}
        </section>
        <SidePanel feed={feed} now={now} player={player} onOpen={setOpen} onNewPitch={() => setPitchOpen(true)} />
      </div>

      {open && <PitchSheet key={open.id} pitch={open} now={now} player={player} onClose={() => setOpen(null)} onShare={share} />}
      <PitchDialog
        feed={feed}
        prompts={openPrompts}
        defaultPrompt={prompt && promptOpen(prompt, now) ? prompt.id : "0"}
        now={now}
        player={player}
        open={pitchOpen}
        onOpenChange={setPitchOpen}
      />
    </div>
  );
}

function Hero({ feed, live }: { feed: FeedData; live: number }) {
  return (
    <section className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge tone="live"><LiveDot /> Live on Arc</Badge>
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tighter sm:text-6xl">
          Back a meme. <span className="text-black/40">At {fmtUsdc(feed.config.target)} it&apos;s born.</span>
        </h1>
        <p className="max-w-2xl text-black/60">
          Anyone pitches a coin for free. When backers put {fmtUsdc(feed.config.target)} behind it, it launches on Uniswap that instant and every backer buys in at the same price. Not filled in {Math.round(feed.config.lifetime / 3600)}h? Everyone gets refunded.
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

function PromptHeader({ prompt, now, pitches }: { prompt: PromptData; now: number; pitches: PitchData[] }) {
  const winner = pitches.find((p) => p.id === prompt.winner);
  const open = promptOpen(prompt, now);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/" className="text-xs text-black/50 hover:text-black">← All pitches</Link>
        <span className="text-xs font-medium uppercase tracking-wider text-black/60">{prompt.kind} prompt</span>
        {winner ? <Badge tone="ink">Won by ${winner.symbol}</Badge> : prompt.cancelled ? <Badge tone="danger">Cancelled · refunds open</Badge> : open ? <Badge tone="live"><LiveDot /> {fmtLeft(prompt.end - now)} left to pitch</Badge> : <Badge>Pitching closed</Badge>}
      </div>
      <h1 className="text-4xl font-semibold leading-[1.05] tracking-tighter sm:text-6xl">{prompt.title}</h1>
      <p className="text-black/60">
        {winner ? `$${winner.symbol} filled first and was born. Every other pitch here is refunding.` : "One coin per prompt: the first pitch here to hit its target is born, and every other pitch is refunded."}
      </p>
      {prompt.sources.length > 0 && (
        <p className="text-sm text-black/60">
          Source:{" "}
          {prompt.sources.map((s, i) => (
            <a key={s} href={s} target="_blank" rel="noreferrer" className="underline decoration-black/30 underline-offset-4 hover:decoration-black">
              {i > 0 && ", "}
              {new URL(s).hostname.replace(/^www\./, "")}
            </a>
          ))}
        </p>
      )}
    </section>
  );
}
