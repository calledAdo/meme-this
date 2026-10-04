"use client";

import { BadgeCheck, Plus, Wallet } from "lucide-react";
import { ConnectButton } from "@/components/ConnectButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, statusOf, type FeedData } from "@/lib/feed";
import { fmtUsdc } from "@/lib/format";
import type { Player } from "./usePlayer";
import { Thumb } from "./PitchRow";

/** The player's own corner: connect, their backings (with anything to claim), and pitching. */
export function SidePanel({ feed, now, player, onOpen, onNewPitch }: { feed: FeedData; now: number; player: Player; onOpen: (id: string) => void; onNewPitch: () => void }) {
  const ready = player.connected && player.onArc;
  const mine = feed.pitches.filter((p) => player.mine.has(p.id));
  const toClaim = mine.filter((p) => statusOf(p, now) !== "live" && !player.mine.get(p.id)!.claimed);
  const active = mine.filter((p) => statusOf(p, now) === "live");

  return (
    <aside className="order-first space-y-4 lg:sticky lg:top-24 lg:order-none lg:self-start">
      {!ready ? (
        <div className="space-y-4 rounded-xl border border-black/10 p-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-black/[0.04] [&_svg]:size-4"><Wallet /></div>
          <div>
            <div className="text-lg font-semibold tracking-tighter">{player.connected ? "Switch to Arc" : "Connect to play"}</div>
            <p className="mt-1 text-sm text-black/60">
              {player.connected ? "Meme This runs on Arc mainnet, where USDC pays for everything, gas included." : "Pitch memes for free and back the ones you love with USDC on Arc. No sign-up."}
            </p>
          </div>
          <ConnectButton full />
        </div>
      ) : (
        <>
          <button onClick={onNewPitch} className="group flex w-full items-center justify-between rounded-xl bg-black p-5 text-left text-white transition-opacity duration-300 hover:opacity-90">
            <div>
              <div className="font-semibold tracking-tighter">Pitch a meme</div>
              <div className="text-sm text-white/60">
                {BigInt(feed.config.pitchFee) > 0n ? fmtUsdc(feed.config.pitchFee) : "Free"} · born at {fmtUsdc(feed.config.target)} of backing
              </div>
            </div>
            <Plus className="size-5 transition-transform duration-300 group-hover:rotate-90" />
          </button>

          {toClaim.length > 0 && (
            <div className="space-y-3 rounded-xl border border-black/10 p-5">
              <div className="text-xs font-medium uppercase tracking-wider text-black/60">Ready to claim</div>
              {toClaim.map((p) => {
                const coins = statusOf(p, now) === "launched";
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <button onClick={() => onOpen(p.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <Thumb p={p} size={36} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold tracking-tighter">${p.symbol}</div>
                        <div className="text-xs text-black/50">{coins ? "Born · your coins" : `${STATUS_LABEL[statusOf(p, now)]} · ${fmtUsdc(player.mine.get(p.id)!.amount)} back`}</div>
                      </div>
                    </button>
                    <Button size="sm" disabled={!!player.busy} onClick={() => player.actions.claim(p.id, coins)}>{coins ? "Claim" : "Refund"}</Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-black/10 p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-black/60">Your backings</div>
            {active.length === 0 ? (
              <p className="text-sm text-black/60">Nothing yet. Tap a pitch to back it with $1–$20. You can back as many as you like and pull out any time before launch.</p>
            ) : (
              active.map((p) => (
                <button key={p.id} onClick={() => onOpen(p.id)} className="flex w-full items-center gap-3 text-left">
                  <Thumb p={p} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold tracking-tighter">${p.symbol}</div>
                    <div className="text-xs text-black/50">{fmtUsdc(p.total)} of {fmtUsdc(p.target)}</div>
                  </div>
                  <span className="font-mono text-sm">{fmtUsdc(player.mine.get(p.id)!.amount)}</span>
                </button>
              ))
            )}
          </div>

          <div className="space-y-2 px-1 text-xs text-black/60">
            <div className="flex justify-between">
              <span>Balance</span>
              <span className="font-mono text-black">{fmtUsdc(player.balance)}</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span>Identity</span>
              {player.pass?.verified ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <BadgeCheck className="size-3.5" /> Verified · {player.pass.provider === "coinbase" ? "Coinbase" : "Passport"}
                </span>
              ) : (
                <span className="text-right">
                  <Badge>Optional</Badge>{" "}
                  <a className="underline underline-offset-4" href="https://passport.human.tech" target="_blank" rel="noreferrer">Get verified</a>
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
