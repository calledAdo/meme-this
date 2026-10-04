"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { Hex } from "viem";
import { usePublicClient } from "wagmi";
import { arc, explorerTx } from "./chain";

export type Step = { title: string; exec: () => Promise<Hex | null> };

const message = (e: unknown) => {
  const err = e as { shortMessage?: string; message?: string };
  const m = err.shortMessage ?? err.message ?? "Transaction failed";
  return /user rejected|denied/i.test(m) ? "You cancelled it in your wallet." : m;
};

/**
 * Runs a sequence of wallet transactions (e.g. approve USDC, then back) with one progress toast:
 * "Approve USDC (1/2)…" then "Back $SKB (2/2)…", then a success toast linking to the explorer.
 * A step may return null when it is not needed (allowance already set).
 */
export function useTx() {
  const client = usePublicClient({ chainId: arc.id });
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(label: string, steps: Step[], after?: () => Promise<void> | void) {
    const id = toast.loading(steps.length > 1 ? `${steps[0].title} (1/${steps.length})` : `${steps[0].title}…`);
    setBusy(label);
    let last: Hex | null = null;
    try {
      for (let i = 0; i < steps.length; i++) {
        toast.loading(steps.length > 1 ? `${steps[i].title} (${i + 1}/${steps.length}) — confirm in wallet` : `${steps[i].title} — confirm in wallet`, { id });
        const hash = await steps[i].exec();
        if (!hash) continue;
        toast.loading(`${steps[i].title} — confirming on Arc…`, { id });
        const receipt = await client!.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error(`${steps[i].title} reverted`);
        last = hash;
      }
      toast.success(label, {
        id,
        description: last ? "Confirmed on Arc" : undefined,
        action: last ? { label: "View", onClick: () => window.open(explorerTx(last!), "_blank") } : undefined,
      });
      await after?.();
      router.refresh();
      return true;
    } catch (e) {
      toast.error(message(e), { id });
      return false;
    } finally {
      setBusy(null);
    }
  }

  return { run, busy, client };
}
