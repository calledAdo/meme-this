"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { statusOf, type FeedData, type PromptData } from "@/lib/feed";
import { fmtLeft, fmtUsdc } from "@/lib/format";
import { encodeMeta, safeImage } from "@/lib/meta";
import { cardQuery } from "@/lib/share";
import type { Player } from "./usePlayer";

/** New pitch form with a live preview of the X card it will share as. */
export function PitchDialog({
  feed,
  prompts,
  defaultPrompt,
  now,
  player,
  open,
  onOpenChange,
}: {
  feed: FeedData;
  prompts: PromptData[]; // prompts still taking pitches
  defaultPrompt: string;
  now: number;
  player: Player;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [promptId, setPromptId] = useState(defaultPrompt);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [image, setImage] = useState("");
  const [lore, setLore] = useState("");
  const [preview, setPreview] = useState("");

  const prompt = prompts.find((p) => p.id === promptId);
  const fee = BigInt(feed.config.pitchFee);
  // The contract is the final word; this only catches the obvious clash before a wallet popup.
  const taken = feed.pitches.some((p) => p.symbol === symbol && ["live", "launched"].includes(statusOf(p, now)));
  const imageOk = !image || !!safeImage(image);
  const valid = name.trim().length > 0 && /^[A-Z0-9]{1,10}$/.test(symbol) && imageOk && !taken && (promptId === "0" || !!prompt);

  useEffect(() => {
    const t = setTimeout(() => {
      setPreview(
        `/card/p/0?${cardQuery({ sym: symbol || "TICKER", name: name || "Your meme", round: prompt?.title ?? "Freestyle", total: 0, backers: 0, min: Number(feed.config.target) / 1e6, end: now + feed.config.lifetime, s: "live", img: safeImage(image) })}`,
      );
    }, 400);
    return () => clearTimeout(t);
    // `now` ticks every second; the preview only needs a rough deadline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, name, image, prompt?.title, feed.config.target, feed.config.lifetime]);

  const submit = async () => {
    const ok = await player.actions.pitch(fee, promptId, name.trim(), symbol, encodeMeta({ image: image || undefined, lore: lore.trim() || undefined }));
    if (ok) {
      setName("");
      setSymbol("");
      setImage("");
      setLore("");
      onOpenChange(false);
    }
  };

  const hours = Math.round(feed.config.lifetime / 3600);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Pitch a meme" description={`${fee > 0n ? `${fmtUsdc(fee)} to pitch` : "Free to pitch"}. If backers put ${fmtUsdc(feed.config.target)} behind it within ${hours}h, it's born as a coin and you earn 50% of its trading fees.`}>
        <div className="space-y-4">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Share card preview" className="aspect-[1200/630] w-full rounded-lg border border-black/10 bg-black" />
          )}
          {prompts.length > 0 && (
            <div>
              <Label hint="the first pitch to launch wins a prompt">Answering</Label>
              <select className="h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm" value={promptId} onChange={(e) => setPromptId(e.target.value)}>
                <option value="0">Freestyle (no prompt)</option>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} · {fmtLeft(p.end - now)} left
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <div>
              <Label hint={`${name.length}/32`}>Name</Label>
              <Input placeholder="Money Printer" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Ticker</Label>
              <Input className="font-mono uppercase" placeholder="BRRR" maxLength={10} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
            </div>
          </div>
          {taken && <p className="-mt-2 text-xs text-destructive">${symbol} is already live or born. Pick another ticker.</p>}
          <div>
            <Label hint="https link to a png, jpg, gif or webp">Image</Label>
            <Input placeholder="https://i.imgur.com/….png" value={image} onChange={(e) => setImage(e.target.value.trim())} />
            {!imageOk && <p className="mt-1 text-xs text-destructive">Use an https:// image link.</p>}
          </div>
          <div>
            <Label hint={`${lore.length}/140`}>Motto</Label>
            <Input placeholder="Money printer go brrr" maxLength={140} value={lore} onChange={(e) => setLore(e.target.value)} />
          </div>
          <Button className="w-full" size="lg" disabled={!valid || !!player.busy} onClick={submit}>
            Pitch ${symbol || "TICKER"}{fee > 0n ? ` for ${fmtUsdc(fee)}` : ""}
          </Button>
          <p className="text-center text-xs text-black/60">Pitch as many as you like. One wallet confirmation and a fraction of a cent in gas.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
