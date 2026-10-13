"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { entityState, statusOf, unofficial, type FeedData } from "@/lib/feed";
import { fmtLeft, fmtUsdc } from "@/lib/format";
import { encodeMeta, looksOfficial, safeImage, safeSource } from "@/lib/meta";
import { cardQuery } from "@/lib/share";
import type { Player } from "./usePlayer";

/**
 * New pitch form with a live preview of the X card it will share as. The pitch joins the entity's live race,
 * or starts one when the entity is idle (Culture can run a few races at once, so there the player may choose).
 */
export function PitchDialog({
  feed,
  entityId: initialEntity,
  lockEntity,
  now,
  player,
  onClose,
}: {
  feed: FeedData;
  entityId: string;
  lockEntity: boolean;
  now: number;
  player: Player;
  onClose: () => void;
}) {
  const [entityId, setEntityId] = useState(initialEntity);
  const [choice, setChoice] = useState<string | null>(null); // race id to join, "0" to start a new one
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [image, setImage] = useState("");
  const [lore, setLore] = useState("");
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState("");

  const entity = feed.entities.find((e) => e.id === entityId);
  const st = entity ? entityState(entity, feed.races, now) : null;
  // Default: join the race closest to its deadline, else start one.
  const raceId = choice && (choice === "0" ? st?.canStart : st?.live.some((r) => r.id === choice)) ? choice : st?.live[0]?.id ?? (st?.canStart ? "0" : null);
  const race = st?.live.find((r) => r.id === raceId);

  const fee = BigInt(feed.config.pitchFee);
  // The contract is the final word; these only catch the obvious problems before a wallet popup.
  const taken = feed.pitches.some((p) => p.symbol === symbol && ["live", "launched"].includes(statusOf(p, now)));
  const official = !!symbol && looksOfficial(symbol, name);
  const imageOk = !image || !!safeImage(image);
  const sourceOk = !source || !!safeSource(source);
  const valid = !!entity && raceId !== null && name.trim().length > 0 && /^[A-Z0-9]{1,10}$/.test(symbol) && imageOk && sourceOk && !taken && !official;
  const deadline = race ? race.end : now + (entity?.window ?? 86400);

  useEffect(() => {
    const t = setTimeout(() => {
      setPreview(
        `/card/p/0?${cardQuery({ sym: symbol || "TICKER", name: name || "Your meme", round: entity?.name ?? "Culture", total: 0, backers: 0, min: Number(feed.config.target) / 1e6, end: deadline, s: "live", img: safeImage(image) })}`,
      );
    }, 400);
    return () => clearTimeout(t);
    // `deadline` moves with the clock for a new race; the preview only needs a rough value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, name, image, entity?.name, feed.config.target]);

  const submit = async () => {
    if (!entity || raceId === null) return;
    const uri = encodeMeta({ image: image || undefined, lore: lore.trim() || undefined, source: safeSource(source) });
    if (await player.actions.pitch(fee, entity.id, raceId, name.trim(), symbol, uri)) onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Pitch a meme"
        description={`${fee > 0n ? `${fmtUsdc(fee)} to pitch` : "Free to pitch"}. The first pitch in a race to reach ${fmtUsdc(feed.config.target)} of backing is born, and its pitcher earns 50% of its trading fees.`}
      >
        <div className="space-y-4">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Share card preview" className="aspect-[1200/630] w-full rounded-lg border border-black/10 bg-black" />
          )}

          {!lockEntity && (
            <div>
              <Label>About</Label>
              <select className="h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm" value={entityId} onChange={(e) => { setEntityId(e.target.value); setChoice(null); }}>
                {feed.entities.map((e) => {
                  const s = entityState(e, feed.races, now);
                  return (
                    <option key={e.id} value={e.id} disabled={!s.canStart && s.live.length === 0}>
                      {e.name}
                      {s.live.length > 0 ? " · race live" : s.coolingFor > 0 ? ` · next race in ${fmtLeft(s.coolingFor)}` : " · start a race"}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {entity && st && (
            <div className="space-y-2 rounded-lg bg-black/[0.03] px-3 py-2.5 text-sm">
              {st.live.length > 0 && st.canStart ? (
                <div className="flex flex-wrap gap-2">
                  {[...st.live.map((r) => ({ id: r.id, label: `Join race · ${fmtLeft(r.end - now)} left` })), { id: "0", label: "Start a new race" }].map((o) => (
                    <button key={o.id} onClick={() => setChoice(o.id)} className={`rounded-md border px-2.5 py-1 text-xs font-medium ${raceId === o.id ? "border-black bg-black text-white" : "border-black/15 bg-white"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="text-black/70">
                {raceId === null
                  ? `${entity.name} just had a coin born. The next race opens in ${fmtLeft(st.coolingFor)}.`
                  : raceId === "0"
                    ? `Your pitch starts a ${Math.round(entity.window / 3600)}h race on ${entity.name}. Others can pitch rivals; the first to fill is born. You earn 20% of the winner's fees for starting it.`
                    : `You're joining the live ${entity.name} race. It ends in ${fmtLeft((race?.end ?? now) - now)}; the first pitch to fill is born.`}
              </p>
              <p className="text-xs text-black/50">{unofficial(entity)}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <div>
              <Label hint={`${name.length}/32`}>Name</Label>
              <Input placeholder="Dogecoin to Mars" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Ticker</Label>
              <Input className="font-mono uppercase" placeholder="DOGEMARS" maxLength={10} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
            </div>
          </div>
          {taken && <p className="-mt-2 text-xs text-destructive">${symbol} is already live or born. Pick another ticker.</p>}
          {official && <p className="-mt-2 text-xs text-destructive">That looks like an official coin. Riff on the moment instead (e.g. $DOGEMARS, not $ELON).</p>}

          {entity?.kind !== "culture" && (
            <div>
              <Label hint="optional · the tweet or article you're riffing on">Source link</Label>
              <Input placeholder="https://x.com/elonmusk/status/…" value={source} onChange={(e) => setSource(e.target.value.trim())} />
              {!sourceOk && <p className="mt-1 text-xs text-destructive">Use a full https:// link (no link shorteners).</p>}
            </div>
          )}
          <div>
            <Label hint="https link to a png, jpg, gif or webp">Image</Label>
            <Input placeholder="https://i.imgur.com/….png" value={image} onChange={(e) => setImage(e.target.value.trim())} />
            {!imageOk && <p className="mt-1 text-xs text-destructive">Use an https:// image link.</p>}
          </div>
          <div>
            <Label hint={`${lore.length}/140`}>Motto</Label>
            <Input placeholder="Next stop: Mars" maxLength={140} value={lore} onChange={(e) => setLore(e.target.value)} />
          </div>
          <Button className="w-full" size="lg" disabled={!valid || !!player.busy} onClick={submit}>
            {raceId === "0" ? `Pitch $${symbol || "TICKER"} & start the race` : `Pitch $${symbol || "TICKER"}`}
            {fee > 0n ? ` for ${fmtUsdc(fee)}` : ""}
          </Button>
          <p className="text-center text-xs text-black/60">Riff on what really happened. Nothing sexual or made up about real people; the moderator removes those and refunds their backers.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
