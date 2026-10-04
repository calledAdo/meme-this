"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { memeArenaAbi } from "@/lib/abi";
import { ARENA, arc, explorerTx } from "@/lib/chain";
import { encodeMeta, type PromptMeta } from "@/lib/meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DURATIONS = [
  ["Pitching open 6h", 6 * 3600],
  ["Pitching open 2h", 2 * 3600],
  ["Pitching open 24h", 24 * 3600],
  ["Pitching open 3 days", 3 * 24 * 3600],
  ["Test (10m)", 10 * 60],
] as const;

/** Host and guardian controls. The contract enforces roles; this page only builds the calls. */
export default function AdminPage() {
  const { address } = useAccount();
  const client = usePublicClient({ chainId: arc.id });
  const { writeContractAsync } = useWriteContract();
  const [log, setLog] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<NonNullable<PromptMeta["kind"]>>("news");
  const [sources, setSources] = useState("");
  const [duration, setDuration] = useState<number>(DURATIONS[0][1]);
  const [pitchId, setPitchId] = useState("");
  const [promptId, setPromptId] = useState("");
  const [reason, setReason] = useState("");

  async function send(label: string, fn: () => Promise<`0x${string}`>) {
    try {
      const hash = await fn();
      await client!.waitForTransactionReceipt({ hash });
      setLog((l) => [`${label}: ${explorerTx(hash)}`, ...l]);
    } catch (e) {
      setLog((l) => [`${label} failed: ${(e as { shortMessage?: string }).shortMessage ?? (e as Error).message}`, ...l]);
    }
  }

  const createPrompt = () => {
    const meta: PromptMeta = { title, kind, sources: sources.split(/[\s,]+/).filter((s) => s.startsWith("https://")) };
    return send("createPrompt", () =>
      writeContractAsync({ address: ARENA, abi: memeArenaAbi, functionName: "createPrompt", args: [duration, encodeMeta(meta)] }),
    );
  };

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-semibold tracking-tighter">Admin</h1>
      {!address && <p className="text-black/60">Connect the host or guardian wallet.</p>}

      <section className="space-y-3 rounded-xl border border-black/10 p-5">
        <h2 className="text-lg font-semibold tracking-tighter">Open a prompt</h2>
        <p className="text-sm text-black/60">The first pitch in a prompt to fill its target is born; the rest are refunded.</p>
        <Input className="" placeholder="Prompt, e.g. Fed cuts rates" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <select className="h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {["news", "event", "theme"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <select className="h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {DURATIONS.map(([l, s]) => (
              <option key={s} value={s}>{l}</option>
            ))}
          </select>
        </div>
        <Input className="" placeholder="Source links (https://…, comma separated; 2 reputable sources for news)" value={sources} onChange={(e) => setSources(e.target.value)} />
        <Button disabled={!address || !title} onClick={createPrompt}>Open prompt</Button>
      </section>

      <section className="space-y-3 rounded-xl border border-black/10 p-5">
        <h2 className="text-lg font-semibold tracking-tighter">Guardian</h2>
        <Input className="" placeholder="Reason (stored on-chain)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex flex-wrap gap-3">
          <Input className="w-40" placeholder="Pitch id" value={pitchId} onChange={(e) => setPitchId(e.target.value)} />
          <Button variant="outline" disabled={!address || !pitchId || !reason} onClick={() =>
            send("veto", () => writeContractAsync({ address: ARENA, abi: memeArenaAbi, functionName: "veto", args: [BigInt(pitchId), reason] }))}>
            Veto pitch
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Input className="w-40" placeholder="Prompt id" value={promptId} onChange={(e) => setPromptId(e.target.value)} />
          <Button variant="outline" disabled={!address || !promptId || !reason} onClick={() =>
            send("cancelPrompt", () => writeContractAsync({ address: ARENA, abi: memeArenaAbi, functionName: "cancelPrompt", args: [BigInt(promptId), reason] }))}>
            Cancel prompt (refunds all)
          </Button>
        </div>
      </section>

      {log.length > 0 && (
        <ul className="space-y-1 font-mono text-xs">
          {log.map((l, i) => <li key={i} className="break-all">{l}</li>)}
        </ul>
      )}
    </div>
  );
}
