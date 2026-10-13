"use client";

import { useState } from "react";
import { keccak256, toBytes } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { memeArenaAbi } from "@/lib/abi";
import { ARENA, arc, explorerTx } from "@/lib/chain";
import { encodeMeta, type EntityMeta } from "@/lib/meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Entity id convention: keccak256("x:<handle lowercased>") for X accounts, keccak256("topic:<slug>") for topics. */
const entityId = (kind: string, key: string) =>
  keccak256(toBytes(kind === "topic" ? `topic:${key.toLowerCase()}` : `x:${key.replace(/^@/, "").toLowerCase()}`));

/** Guardian controls. The contract enforces the role; this page only builds the calls. */
export default function AdminPage() {
  const { address } = useAccount();
  const client = usePublicClient({ chainId: arc.id });
  const { writeContractAsync } = useWriteContract();
  const [log, setLog] = useState<string[]>([]);

  const [kind, setKind] = useState<NonNullable<EntityMeta["kind"]>>("person");
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [pitchId, setPitchId] = useState("");
  const [raceId, setRaceId] = useState("");
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

  const key = handle.replace(/^@/, "").trim();
  const setEntity = () => {
    const meta: EntityMeta = kind === "topic" ? { name, kind } : { name, kind, x: key };
    return send(`setEntity ${name}`, () =>
      writeContractAsync({
        address: ARENA,
        abi: memeArenaAbi,
        functionName: "setEntity",
        args: [entityId(kind, key), active, 1, 24 * 3600, 6 * 3600, encodeMeta(meta)],
      }),
    );
  };

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-semibold tracking-tighter">Admin</h1>
      {!address && <p className="text-black/60">Connect the guardian wallet.</p>}

      <section className="space-y-3 rounded-xl border border-black/10 p-5">
        <h2 className="text-lg font-semibold tracking-tighter">Approve an entity</h2>
        <p className="text-sm text-black/60">Public figures, organisations and topics only. Never private individuals. 24h races, 6h cooldown after a birth.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <select className="h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {["person", "org", "topic"].map((k) => <option key={k}>{k}</option>)}
          </select>
          <Input placeholder={kind === "topic" ? "Slug, e.g. fed" : "X handle, e.g. elonmusk"} value={handle} onChange={(e) => setHandle(e.target.value)} />
          <Input placeholder="Display name, e.g. Elon Musk" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (untick to retire)
        </label>
        <Button disabled={!address || !key || !name} onClick={setEntity}>Save entity</Button>
      </section>

      <section className="space-y-3 rounded-xl border border-black/10 p-5">
        <h2 className="text-lg font-semibold tracking-tighter">Moderation</h2>
        <Input placeholder="Reason (stored on-chain)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex flex-wrap gap-3">
          <Input className="w-40" placeholder="Pitch id" value={pitchId} onChange={(e) => setPitchId(e.target.value)} />
          <Button variant="outline" disabled={!address || !pitchId || !reason} onClick={() =>
            send("veto", () => writeContractAsync({ address: ARENA, abi: memeArenaAbi, functionName: "veto", args: [BigInt(pitchId), reason] }))}>
            Veto pitch (refunds its backers)
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Input className="w-40" placeholder="Race id" value={raceId} onChange={(e) => setRaceId(e.target.value)} />
          <Button variant="outline" disabled={!address || !raceId || !reason} onClick={() =>
            send("cancelRace", () => writeContractAsync({ address: ARENA, abi: memeArenaAbi, functionName: "cancelRace", args: [BigInt(raceId), reason] }))}>
            Cancel race (refunds all)
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
