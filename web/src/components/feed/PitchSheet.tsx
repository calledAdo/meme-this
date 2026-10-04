"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { explorerAddress, uniswapSwapUrl } from "@/lib/chain";
import { STATUS_LABEL, progress, remaining, statusOf, type Backer, type PitchData } from "@/lib/feed";
import { fmtLeft, fmtUsdc, short, usdc } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Player } from "./usePlayer";
import { Thumb } from "./PitchRow";

const CHIPS = [1, 2, 5, 10, 20];

export function PitchSheet({ pitch, now, player, onClose, onShare }: { pitch: PitchData; now: number; player: Player; onClose: () => void; onShare: (id: string) => void }) {
  const s = statusOf(pitch, now);
  const my = player.mine.get(pitch.id);
  const left = usdc(remaining(pitch));
  const room = Math.min(usdc(pitch.maxPerPerson) - usdc(my?.amount ?? 0n), left);
  const [amount, setAmount] = useState(() => String(Math.min(2, Math.max(room, 0))));
  const n = Number(amount);
  const ripens = n >= left - 1e-9;
  const valid = Number.isFinite(n) && n > 0 && n <= room + 1e-9 && (n >= 1 || ripens || !!my);

  const backers = useQuery({
    queryKey: ["backers", pitch.id, pitch.total],
    queryFn: async (): Promise<Backer[]> => {
      const r = await fetch(`/api/backers/${pitch.id}`);
      if (!r.ok) throw new Error("unavailable");
      return r.json();
    },
  });

  let action: React.ReactNode = null;
  if (!player.connected || !player.onArc) {
    action = <p className="text-sm text-black/60">Connect a wallet on Arc to back this pitch.</p>;
  } else if (s === "live" && room > 0) {
    action = (
      <div className="space-y-3">
        <div className="flex gap-2">
          {CHIPS.filter((c) => c < room).map((c) => (
            <button key={c} onClick={() => setAmount(String(c))} className={cn("h-9 flex-1 rounded-lg border text-sm font-medium tracking-tight transition-colors", Number(amount) === c ? "border-black bg-black text-white" : "border-black/15 hover:bg-black/[0.04]")}>
              ${c}
            </button>
          ))}
          {left <= usdc(pitch.maxPerPerson) - usdc(my?.amount ?? 0n) && (
            <button onClick={() => setAmount(String(left))} className={cn("h-9 flex-1 whitespace-nowrap rounded-lg border px-2 text-sm font-medium tracking-tight transition-colors", ripens ? "border-black bg-black text-white" : "border-black/15 hover:bg-black/[0.04]")}>
              Fill ${left.toFixed(2)}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-black/15 px-3 focus-within:border-black">
          <span className="text-black/50">$</span>
          <input className="h-10 flex-1 bg-transparent font-mono text-sm outline-none" value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Amount in USDC" />
          <span className="text-xs text-black/50">max {fmtUsdc(BigInt(Math.round(room * 1e6)))}</span>
        </div>
        <Button className="w-full" size="lg" disabled={!valid || !!player.busy} onClick={() => player.actions.back(pitch.id, pitch.symbol, amount, ripens)}>
          {ripens ? `Back $${amount} & launch $${pitch.symbol}` : `Back $${pitch.symbol} with $${amount || 0}`}
        </Button>
        <p className="text-xs text-black/60">
          {ripens
            ? "This fills the target: your transaction creates the coin and its pool, and every backer buys in together at one price."
            : `Held by the contract, not by anyone. When backing hits ${fmtUsdc(pitch.target)} the coin is born automatically. If it doesn't within ${fmtLeft(pitch.expires - now)}, you get it all back.`}
        </p>
      </div>
    );
  } else if (s === "live") {
    action = <p className="text-sm text-black/60">You&apos;ve reached the {fmtUsdc(pitch.maxPerPerson)} limit for this pitch.</p>;
  }

  let mineBlock: React.ReactNode = null;
  if (my) {
    const coins = s === "launched";
    mineBlock = (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-4 py-3">
        <div>
          <div className="text-xs text-black/60">You backed</div>
          <div className="font-mono font-semibold">
            {fmtUsdc(my.amount)} <span className="text-xs font-normal text-black/50">· {(Number(my.weighted) / Number(my.amount)).toFixed(2)}× early bonus</span>
          </div>
        </div>
        {s === "live" ? (
          <Button variant="outline" size="sm" disabled={!!player.busy} onClick={() => player.actions.withdraw(pitch.id, pitch.symbol)}>Withdraw</Button>
        ) : my.claimed ? (
          <Badge>Claimed</Badge>
        ) : (
          <Button size="sm" disabled={!!player.busy} onClick={() => player.actions.claim(pitch.id, coins)}>{coins ? "Claim coins" : "Claim refund"}</Button>
        )}
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right" title={`$${pitch.symbol}`} description={pitch.name}>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Thumb p={pitch} size={88} />
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={s === "launched" ? "ink" : s === "live" ? "live" : s === "vetoed" ? "danger" : "neutral"}>{STATUS_LABEL[s]}</Badge>
                {pitch.promptId !== "0" && (
                  <Link href={`/prompt/${pitch.promptId}`}>
                    <Badge>for “{pitch.promptTitle ?? `prompt ${pitch.promptId}`}”</Badge>
                  </Link>
                )}
              </div>
              {pitch.lore && <p className="text-sm text-black/70">{pitch.lore}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-2xl font-semibold tracking-tighter">{fmtUsdc(pitch.total)}</span>
              <span className="text-sm text-black/60">of {fmtUsdc(pitch.target)} to launch</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
              <div className={cn("h-full rounded-full", s === "launched" ? "bg-black" : "bg-positive")} style={{ width: `${progress(pitch) * 100}%` }} />
            </div>
            <div className="flex justify-between text-xs text-black/50">
              <span>{pitch.backers} {pitch.backers === 1 ? "backer" : "backers"}{pitch.verifiedBackers > 0 && ` · ${pitch.verifiedBackers} verified`}</span>
              <span>
                {s === "live" ? `${fmtLeft(pitch.expires - now)} left` : s === "launched" ? "Coin born" : s === "lost" ? "Another pitch won this prompt · refunds open" : s === "expired" ? "Didn't fill in time · refunds open" : "Removed by the moderator · refunds open"}
              </span>
            </div>
          </div>

          {mineBlock}
          {action}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onShare(pitch.id)}>
              <Share2 /> Share on X
            </Button>
            {pitch.token && (
              <a href={uniswapSwapUrl(pitch.token)} target="_blank" rel="noreferrer" className="flex-1">
                <Button variant="outline" className="w-full">Trade <ArrowUpRight /></Button>
              </a>
            )}
          </div>

          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-black/60">Backers</div>
            {backers.isPending ? (
              <p className="text-sm text-black/50">Loading…</p>
            ) : !backers.data || backers.data.length === 0 ? (
              <p className="text-sm text-black/50">{backers.isError ? "Couldn't load backers right now." : "No backers yet. Be the first: early dollars earn up to 1.25×."}</p>
            ) : (
              <ul className="divide-y divide-black/10 rounded-lg border border-black/10 text-sm">
                {backers.data.map((b) => (
                  <li key={b.wallet} className="flex items-center justify-between px-3 py-2">
                    <a href={explorerAddress(b.wallet)} target="_blank" rel="noreferrer" className="font-mono text-xs hover:underline">
                      {short(b.wallet)}
                      {b.wallet.toLowerCase() === player.address?.toLowerCase() && " (you)"}
                    </a>
                    <span className="font-mono text-xs">
                      {fmtUsdc(b.amount)}
                      {b.verified && <span className="ml-2 text-emerald-700">verified</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="font-mono text-xs text-black/40">pitched by {short(pitch.pitcher)}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
