"use client";

import { ArrowUpRight, ChevronDown, LogOut, QrCode, Smartphone, Wallet } from "lucide-react";
import { useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { useAccount, useConnect, useDisconnect, useSwitchChain, type Connector } from "wagmi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { arc } from "@/lib/chain";
import { cn } from "@/lib/cn";
import { short } from "@/lib/format";
import { isMobileWalletBrowser, metamaskBrowserUrl, walletConnectionState, walletError, walletOptions } from "@/lib/wallet";

/** Browser wallets plus phone pairing for browsers such as Safari. */
export function ConnectButton({ full }: { full?: boolean }) {
  const connection = useAccount();
  const { address, isReconnecting } = connection;
  const wallet = walletConnectionState(connection, arc.id);
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [appUrl, setAppUrl] = useState<string | null>(null);

  const options = walletOptions(connectors);
  const installed = options.filter((c) => c.type === "injected");
  const remote = options.filter((c) => c.type !== "injected");
  const hasPairing = remote.some((c) => c.type === "walletConnect");

  function changeOpen(next: boolean) {
    if (next) {
      setError(null);
      setMobile(isMobileWalletBrowser(navigator.userAgent, navigator.maxTouchPoints));
      setAppUrl(metamaskBrowserUrl(window.location.href));
    }
    setOpen(next);
  }

  async function connect(connector: Connector) {
    if (isPending) return;
    setError(null);
    // Release our focus trap before a wallet SDK opens its own QR / app modal.
    flushSync(() => setOpen(false));
    try {
      await connectAsync({ connector, chainId: arc.id });
    } catch (e) {
      setError(walletError(e));
      setOpen(true);
    }
  }

  if (wallet.connected && !wallet.onChain) {
    return (
      <div className={cn("flex items-center gap-2", full && "w-full")}>
        <Button className={cn(full && "flex-1")} disabled={isSwitching} onClick={async () => {
          try {
            await switchChainAsync({ chainId: arc.id });
          } catch (e) {
            toast.error(walletError(e));
          }
        }}>
          {isSwitching ? "Switching…" : "Switch to Arc"}
        </Button>
        <Button variant="outline" onClick={() => disconnect()} aria-label="Disconnect wallet" title="Disconnect wallet"><LogOut /></Button>
      </div>
    );
  }
  if (address) {
    return (
      <Button variant="outline" className={cn("font-mono", full && "w-full")} onClick={() => disconnect()} aria-label={`Disconnect wallet ${short(address)}`} title="Disconnect wallet">
        {short(address)} <LogOut className="text-black/40" />
      </Button>
    );
  }

  const walletButton = (c: Connector) => {
    const pairing = c.type === "walletConnect";
    return (
      <button
        key={c.uid}
        type="button"
        disabled={isPending}
        className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-black/10 px-4 py-3 text-left transition-colors hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
        onClick={() => connect(c)}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-black/[0.04]">
          {c.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.icon} alt="" className="size-6 rounded" />
          ) : pairing ? <QrCode className="size-5" /> : <Wallet className="size-5" />}
        </span>
        <span className="flex-1">
          <span className="block text-sm font-medium">{pairing ? "Connect a mobile wallet" : c.name}</span>
          <span className="block text-xs text-black/60">
            {pairing ? (mobile ? "Choose your wallet app · WalletConnect" : "Scan a QR code with your wallet · WalletConnect") : c.type === "injected" ? "Detected in this browser" : "Connect with the Coinbase Wallet app"}
          </span>
        </span>
        <ArrowUpRight className="size-4 text-black/40" />
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button className={cn(full && "w-full")} disabled={isPending}>
          {isPending ? "Connecting…" : wallet.pending ? (isReconnecting ? "Reconnecting…" : "Connecting…") : "Connect wallet"} <ChevronDown />
        </Button>
      </DialogTrigger>
      <DialogContent title="Connect your wallet" description="Use a wallet that supports Arc. Your wallet holds your funds and approves every transaction." className="max-w-md">
        <div className="space-y-4">
          {installed.length > 0 && (
            <section className="space-y-2" aria-label="Browser wallets">
              <p className="text-xs font-medium uppercase tracking-wider text-black/50">In this browser</p>
              {installed.map(walletButton)}
            </section>
          )}
          {installed.length === 0 && (
            <p className="text-sm text-black/60">
              {hasPairing ? "No browser wallet detected. Connect your phone wallet below." : "No browser wallet detected. On mobile, open this page in your wallet app's browser. On desktop, use a browser with a wallet extension."}
            </p>
          )}
          <section className="space-y-2" aria-label="Wallet apps">
            {remote.map(walletButton)}
            {mobile && appUrl && installed.length === 0 && (
              <a href={appUrl} className="flex min-h-14 items-center gap-3 rounded-lg border border-black/10 px-4 py-3 text-sm hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2">
                <Smartphone className="size-5" />
                <span className="flex-1">
                  <span className="block font-medium">Open in MetaMask</span>
                  <span className="block text-xs text-black/60">Continue on this page inside the wallet app</span>
                </span>
                <ArrowUpRight className="size-4 text-black/40" />
              </a>
            )}
          </section>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-destructive">{error}</p>}
          <p className="text-xs text-black/50">Arc uses USDC for both backing and network fees.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
