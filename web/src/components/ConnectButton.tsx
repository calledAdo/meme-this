"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { arc } from "@/lib/chain";
import { cn } from "@/lib/cn";
import { short } from "@/lib/format";

/** Wallet button. Lists each installed wallet (EIP-6963) plus Coinbase Wallet. */
export function ConnectButton({ full }: { full?: boolean }) {
  const { address, chainId, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isConnected && chainId !== arc.id) {
    return (
      <Button className={cn(full && "w-full")} onClick={() => switchChain({ chainId: arc.id })}>
        Switch to Arc
      </Button>
    );
  }
  if (isConnected && address) {
    return (
      <Button variant="outline" className={cn("font-mono", full && "w-full")} onClick={() => disconnect()} title="Disconnect">
        {short(address)} <LogOut className="text-black/40" />
      </Button>
    );
  }

  const unique = connectors.filter((c, i) => connectors.findIndex((o) => o.name === c.name) === i);
  return (
    <div className={cn("relative", full && "w-full")}>
      <Button className={cn(full && "w-full")} disabled={isPending} onClick={() => setOpen((o) => !o)}>
        {isPending ? "Connecting…" : "Connect wallet"} <ChevronDown />
      </Button>
      {open && (
        <div className={cn("absolute z-30 mt-2 space-y-1 rounded-xl border border-black/10 bg-white p-1.5 shadow-sm", full ? "inset-x-0" : "right-0 w-60")}>
          {unique.map((c) => (
            <button
              key={c.uid}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm tracking-tight transition-colors hover:bg-black/[0.04]"
              onClick={async () => {
                setError(null);
                try {
                  await connectAsync({ connector: c, chainId: arc.id });
                  setOpen(false);
                } catch (e) {
                  setError((e as { shortMessage?: string }).shortMessage ?? (e as Error).message);
                }
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.icon ? <img src={c.icon} alt="" className="size-5 rounded" /> : <span className="size-5 rounded bg-black/10" />}
              {c.name}
            </button>
          ))}
          {error && <p className="px-2.5 py-1 text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
