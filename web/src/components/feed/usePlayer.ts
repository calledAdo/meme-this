"use client";

import { useQuery } from "@tanstack/react-query";
import { parseUnits, zeroAddress, type Hex } from "viem";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { memeArenaAbi } from "@/lib/abi";
import { ARENA, USDC, arc, erc20Abi } from "@/lib/chain";
import { useTx, type Step } from "@/lib/useTx";

type Pass = { verified: true; provider: string; identityId: string; deadline: string; signature: Hex } | { verified: false; passportScore: number | null };

export type MyBacking = { amount: bigint; weighted: bigint; verified: boolean; claimed: boolean };

/** The connected player's backings across the pitches on screen, plus the actions they can take. */
export function usePlayer(pitchIds: string[]) {
  const { address, chainId } = useAccount();
  const me = address ?? zeroAddress;
  const enabled = !!address;
  const { writeContractAsync } = useWriteContract();
  const tx = useTx();

  const backings = useReadContracts({
    contracts: pitchIds.map((id) => ({ address: ARENA, abi: memeArenaAbi, functionName: "backings", args: [BigInt(id), me] }) as const),
    query: { enabled: enabled && pitchIds.length > 0 },
  });
  const balance = useReadContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [me], query: { enabled } });
  const pass = useQuery({
    queryKey: ["pass", address],
    enabled,
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<Pass> => {
      const r = await fetch("/api/pass", { method: "POST", body: JSON.stringify({ wallet: address }) });
      return r.ok ? r.json() : { verified: false, passportScore: null };
    },
  });

  const mine = new Map<string, MyBacking>();
  backings.data?.forEach((r, i) => {
    if (r.status !== "success") return;
    const [amount, weighted, verified, claimed] = r.result as readonly [bigint, bigint, boolean, boolean];
    if (amount > 0n) mine.set(pitchIds[i], { amount, weighted, verified, claimed });
  });

  const refetch = async () => {
    await Promise.all([backings.refetch(), balance.refetch()]);
  };

  const approve = (raw: bigint): Step => ({
    title: "Approve USDC",
    exec: async () => {
      if (raw === 0n) return null;
      const allowance = await tx.client!.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [address!, ARENA] });
      if (allowance >= raw) return null;
      return writeContractAsync({ address: USDC, abi: erc20Abi, functionName: "approve", args: [ARENA, raw] });
    },
  });

  const call = (title: string, functionName: string, args: readonly unknown[]): Step => ({
    title,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exec: () => writeContractAsync({ address: ARENA, abi: memeArenaAbi, functionName: functionName as any, args: args as any }),
  });

  const actions = {
    /** `ripens` only changes the wording: the contract launches the coin itself when this backing hits the target. */
    back: (pitchId: string, symbol: string, usd: string, ripens: boolean) => {
      const raw = parseUnits(usd || "0", 6);
      const p = pass.data?.verified ? pass.data : null;
      return tx.run(ripens ? `$${symbol} is born!` : `Backed $${symbol} with $${usd}`, [
        approve(raw),
        call(ripens ? `Back & launch $${symbol}` : `Back $${symbol}`, "back", [BigInt(pitchId), raw, p ? BigInt(p.identityId) : 0n, p ? BigInt(p.deadline) : 0n, p ? p.signature : "0x"]),
      ], refetch);
    },
    withdraw: (pitchId: string, symbol: string) => tx.run(`Pulled your backing from $${symbol}`, [call("Withdraw", "withdraw", [BigInt(pitchId)])], refetch),
    claim: (pitchId: string, coins: boolean) =>
      tx.run(coins ? "Coins claimed" : "Refund claimed", [call(coins ? "Claim coins" : "Claim refund", "claim", [BigInt(pitchId)])], refetch),
    /** `raceId` "0" starts a new race on the entity; otherwise the pitch joins that live race. */
    pitch: (fee: bigint, entityId: `0x${string}`, raceId: string, name: string, symbol: string, uri: string) =>
      tx.run(raceId === "0" ? `Pitched $${symbol} and started the race` : `Pitched $${symbol}`, [
        approve(fee),
        call(`Pitch $${symbol}`, "pitch", [entityId, BigInt(raceId), name, symbol, uri]),
      ], refetch),
  };

  return {
    address,
    connected: !!address,
    onArc: chainId === arc.id,
    mine,
    balance: balance.data ?? 0n,
    pass: pass.data ?? null,
    busy: tx.busy,
    actions,
  };
}

export type Player = ReturnType<typeof usePlayer>;
